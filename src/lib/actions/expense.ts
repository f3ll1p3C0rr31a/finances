"use server"

import { mkdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"

import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"
import { revalidatePath } from "next/cache"
import { Prisma } from "@/generated/prisma/client"
import { addMonths, monthKeyFromDate } from "@/lib/calculations/month"
import { currentMonth } from "@/lib/calculations/month"
import { resolveDueDate } from "@/lib/calculations/businessDay"
import { resolveInstallmentAmounts } from "@/lib/calculations/installments"
import { sumAmounts } from "@/lib/calculations/money"
import { adjustActualBalance, recalcOpeningBalanceChain } from "@/lib/actions/monthly"
import { deleteExpenseForUser } from "@/lib/services/deleteExpense"
import { propagateExpenseTraits } from "@/lib/services/recurringEntries"
import { assertOwnedPixKey } from "@/lib/services/ownership"
import { movesOwnMoney } from "@/lib/calculations/balanceChain"
import {
  expenseEntrySchema,
  expenseReferencesSchema,
  recurrenceScopeSchema,
  type ExpenseEntryInput,
  type RecurrenceScope,
} from "@/lib/validation/schemas"

function revalidateMonth(month: Date) {
  revalidatePath(`/dashboard/${monthKeyFromDate(month)}`)
}

function cleanExternalLink(value: string | null | undefined) {
  return value?.trim() || null
}

function safeFileName(name: string) {
  return name.normalize("NFKD").replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").slice(0, 120)
}

/**
 * Keeps the plan's stored total in sync with the installments actually on
 * record, so editing a single parcel (a renegotiated boleto, say) doesn't
 * leave the plan advertising a total nobody owes.
 */
async function refreshPlanTotal(planId: string) {
  const entries = await prisma.expenseEntry.findMany({
    where: { installmentPlanId: planId },
    select: { amount: true },
  })
  if (entries.length === 0) return
  await prisma.expenseInstallmentPlan.update({
    where: { id: planId },
    data: { totalAmount: sumAmounts(entries.map((entry) => entry.amount)) },
  })
}

export async function createExpenseEntry(month: Date, input: ExpenseEntryInput) {
  const userId = await requireUserId()
  const data = expenseEntrySchema.parse(input)
  const entryMonth = data.uncertain ? currentMonth() : month
  const recurring = data.recurring && !data.uncertain && data.category !== "ONE_OFF"
  // Recurrence has no fixed end and an uncertain expense has no schedule, so
  // neither can be split into a fixed installment plan.
  const installmentCount = recurring || data.uncertain ? 1 : data.installmentCount
  const dueDate =
    !data.uncertain && data.dueDay
      ? resolveDueDate(entryMonth, data.dueDayType, data.dueDay)
      : null
  const paidByName = data.paidBy === "THIRD_PARTY" ? data.paidByName ?? null : null
  await assertOwnedPixKey(userId, data.pixKeyId)

  const paymentFields = {
    paidBy: data.paidBy,
    paidByName,
    paymentMethod: data.paymentMethod,
    pixKeyId: data.pixKeyId ?? null,
    externalLink: cleanExternalLink(data.externalLink),
    boletoNumber: data.boletoNumber,
  }

  if (installmentCount > 1) {
    const { totalAmount, slices } = resolveInstallmentAmounts(
      data.amount,
      data.amountMode,
      installmentCount
    )

    const plan = await prisma.expenseInstallmentPlan.create({
      data: {
        userId,
        name: data.name,
        totalAmount,
        installmentCount,
        startMonth: entryMonth,
        entries: {
          create: slices.map((amount, index) => {
            const installmentMonth = addMonths(entryMonth, index)
            return {
              userId,
              name: data.name,
              category: data.category,
              month: installmentMonth,
              dueDate: data.dueDay
                ? resolveDueDate(installmentMonth, data.dueDayType, data.dueDay)
                : null,
              dueDayType: data.dueDayType,
              dueDayValue: data.dueDay ?? null,
              amount,
              installmentNo: index + 1,
              ...paymentFields,
              // Each parcel is billed by its own boleto, so the number typed
              // at creation belongs to the first one only.
              boletoNumber: index === 0 ? paymentFields.boletoNumber : null,
            }
          }),
        },
      },
      include: { entries: { orderBy: { installmentNo: "asc" } } },
    })

    await recalcOpeningBalanceChain(userId, entryMonth)
    // The plan spans several months, so a single month path isn't enough.
    revalidatePath("/dashboard", "layout")
    return { id: plan.entries[0].id }
  }

  let entryId: string

  if (recurring) {
    const template = await prisma.expenseTemplate.create({
      data: {
        userId,
        name: data.name,
        category: data.category,
        defaultAmount: data.amount,
        dayOfMonth: data.dueDay ?? null,
        dueDayType: data.dueDayType,
        startMonth: entryMonth,
      },
    })
    const entry = await prisma.expenseEntry.create({
      data: {
        userId,
        templateId: template.id,
        name: data.name,
        category: data.category,
        month: entryMonth,
        dueDate,
        dueDayType: data.dueDayType,
        dueDayValue: data.dueDay ?? null,
        amount: data.amount,
        ...paymentFields,
      },
    })
    entryId = entry.id
  } else {
    const entry = await prisma.expenseEntry.create({
      data: {
        userId,
        name: data.name,
        category: data.category,
        month: entryMonth,
        dueDate,
        dueDayType: data.dueDayType,
        dueDayValue: data.dueDay ?? null,
        amount: data.amount,
        uncertain: data.uncertain,
        ...paymentFields,
      },
    })
    entryId = entry.id
  }

  await recalcOpeningBalanceChain(userId, entryMonth)
  revalidateMonth(entryMonth)
  return { id: entryId }
}

export async function updateExpenseEntry(id: string, input: ExpenseEntryInput) {
  const userId = await requireUserId()
  const data = expenseEntrySchema.parse(input)
  const paidByName = data.paidBy === "THIRD_PARTY" ? data.paidByName ?? null : null

  await assertOwnedPixKey(userId, data.pixKeyId)

  const existing = await prisma.expenseEntry.findUniqueOrThrow({ where: { id, userId } })
  if (existing.templateId && data.uncertain) {
    throw new Error("A recurring expense cannot become uncertain")
  }
  if (existing.installmentPlanId && data.uncertain) {
    throw new Error("An installment cannot become uncertain")
  }

  const entry = await prisma.expenseEntry.update({
    where: { id, userId },
    data: {
      name: data.name,
      amount: data.amount,
      category: data.category,
      dueDayType: data.dueDayType,
      dueDayValue: data.uncertain ? null : data.dueDay ?? null,
      dueDate:
        !data.uncertain && data.dueDay
          ? resolveDueDate(existing.month, data.dueDayType, data.dueDay)
          : null,
      uncertain: data.uncertain,
      paidBy: data.paidBy,
      paidByName,
      paymentMethod: data.paymentMethod,
      pixKeyId: data.pixKeyId ?? null,
      externalLink: cleanExternalLink(data.externalLink),
      boletoNumber: data.boletoNumber,
    },
  })

  if (existing.installmentPlanId) {
    // Toda parcela é a mesma dívida: nome e categoria valem para o plano
    // inteiro; valor, link, número de boleto e anexo continuam por parcela.
    if (existing.name !== data.name || existing.category !== data.category) {
      await prisma.$transaction([
        prisma.expenseInstallmentPlan.update({
          where: { id: existing.installmentPlanId },
          data: { name: data.name },
        }),
        prisma.expenseEntry.updateMany({
          where: { userId, installmentPlanId: existing.installmentPlanId },
          data: { name: data.name, category: data.category },
        }),
      ])
    }
    if (!existing.amount.equals(data.amount)) {
      await refreshPlanTotal(existing.installmentPlanId)
    }
  }

  // O saldo real só carrega despesa paga que seja sua. Muda tanto ao editar o
  // valor quanto ao trocar quem paga: virar "terceiro" devolve o valor ao
  // saldo, e voltar para "eu" desconta de novo.
  const impactBefore =
    existing.paid && existing.paidBy !== "THIRD_PARTY"
      ? existing.paidAmount ?? existing.amount
      : new Prisma.Decimal(0)
  const impactAfter =
    existing.paid && data.paidBy !== "THIRD_PARTY"
      ? existing.paidAmount ?? new Prisma.Decimal(data.amount)
      : new Prisma.Decimal(0)
  if (!impactBefore.equals(impactAfter)) {
    await adjustActualBalance(userId, entry.month, impactBefore.sub(impactAfter))
  }

  // Conta recorrente carrega as novas características para os meses seguintes
  // ainda abertos, e o template acompanha para os meses ainda não gerados.
  if (entry.templateId) {
    await propagateExpenseTraits(userId, existing, entry)
    await prisma.expenseTemplate.update({
      where: { id: entry.templateId },
      data: {
        name: data.name,
        category: data.category,
        defaultAmount: data.amount,
        dayOfMonth: data.dueDay ?? null,
        dueDayType: data.dueDayType,
      },
    })
  }

  // O valor do mês entra no fechamento planejado, que é o saldo inicial do mês
  // seguinte: sem recalcular, as aberturas à frente ficariam desatualizadas.
  await recalcOpeningBalanceChain(userId, entry.month)

  revalidatePath("/dashboard", "layout")
  revalidateMonth(entry.month)
}

export async function setExpensePaid(id: string, paid: boolean) {
  const userId = await requireUserId()
  const existing = await prisma.expenseEntry.findUniqueOrThrow({ where: { id, userId } })
  if (existing.paid === paid) return

  const entry = await prisma.expenseEntry.update({
    where: { id, userId },
    data: {
      paid,
      paidAt: paid ? new Date() : null,
    },
  })

  // Terceiro é só controle: marcar como paga não tira nada do seu saldo.
  if (movesOwnMoney(entry)) {
    const amount = entry.paidAmount ?? entry.amount
    await adjustActualBalance(userId, entry.month, paid ? amount.neg() : amount)
  }
  if (entry.uncertain) {
    await recalcOpeningBalanceChain(userId, entry.month)
  }

  revalidateMonth(entry.month)
}

export async function deleteExpenseEntry(id: string, scope: RecurrenceScope = "ONLY_THIS") {
  const userId = await requireUserId()
  const result = await deleteExpenseForUser(userId, id, recurrenceScopeSchema.parse(scope))
  revalidatePath("/dashboard", "layout")
  return result
}

export async function saveExpenseReferences(
  id: string,
  input: { externalLink?: string | null; boletoNumber?: string | null }
) {
  const userId = await requireUserId()
  const data = expenseReferencesSchema.parse(input)
  const entry = await prisma.expenseEntry.update({
    where: { id, userId },
    data: {
      externalLink: data.externalLink,
      boletoNumber: data.boletoNumber,
    },
  })
  revalidateMonth(entry.month)
}

export async function uploadExpenseAttachment(id: string, formData: FormData) {
  const userId = await requireUserId()
  const file = formData.get("file")
  if (!(file instanceof File)) throw new Error("Arquivo inválido")
  if (file.type !== "application/pdf") throw new Error("Envie um PDF")
  if (file.size > 10 * 1024 * 1024) throw new Error("PDF maior que 10 MB")

  const existing = await prisma.expenseEntry.findUniqueOrThrow({ where: { id, userId } })
  const bytes = Buffer.from(await file.arrayBuffer())
  const relativeDir = path.join("storage", "boletos", userId, id)
  const absoluteDir = path.join(/*turbopackIgnore: true*/ process.cwd(), relativeDir)
  await mkdir(absoluteDir, { recursive: true })

  if (existing.attachmentPath) {
    await rm(path.join(/*turbopackIgnore: true*/ process.cwd(), existing.attachmentPath), {
      force: true,
    })
  }

  const filename = `${Date.now()}-${safeFileName(file.name || "boleto.pdf")}`
  const relativePath = path.join(relativeDir, filename)
  await writeFile(path.join(/*turbopackIgnore: true*/ process.cwd(), relativePath), bytes)

  await prisma.expenseEntry.update({
    where: { id, userId },
    data: {
      attachmentFileName: file.name || "boleto.pdf",
      attachmentPath: relativePath,
      attachmentUploadedAt: new Date(),
    },
  })
  revalidateMonth(existing.month)
}

export async function removeExpenseAttachment(id: string) {
  const userId = await requireUserId()
  const existing = await prisma.expenseEntry.findUniqueOrThrow({ where: { id, userId } })
  if (existing.attachmentPath) {
    await rm(path.join(/*turbopackIgnore: true*/ process.cwd(), existing.attachmentPath), {
      force: true,
    })
  }
  await prisma.expenseEntry.update({
    where: { id, userId },
    data: {
      attachmentFileName: null,
      attachmentPath: null,
      attachmentUploadedAt: null,
    },
  })
  revalidateMonth(existing.month)
}
