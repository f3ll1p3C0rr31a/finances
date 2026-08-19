"use server"

import { mkdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"

import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"
import { revalidatePath } from "next/cache"
import { Prisma } from "@/generated/prisma/client"
import { monthKeyFromDate } from "@/lib/calculations/month"
import { currentMonth } from "@/lib/calculations/month"
import { resolveDueDate } from "@/lib/calculations/businessDay"
import { adjustActualBalance, recalcOpeningBalanceChain } from "@/lib/actions/monthly"
import { deleteExpenseForUser } from "@/lib/services/deleteExpense"
import { propagateExpenseTraits } from "@/lib/services/recurringEntries"
import { assertOwnedPixKey } from "@/lib/services/ownership"
import { movesOwnMoney } from "@/lib/calculations/balanceChain"
import { expenseEntrySchema, type ExpenseEntryInput } from "@/lib/validation/schemas"

function revalidateMonth(month: Date) {
  revalidatePath(`/dashboard/${monthKeyFromDate(month)}`)
}

function cleanExternalLink(value: string | null | undefined) {
  return value?.trim() || null
}

function safeFileName(name: string) {
  return name.normalize("NFKD").replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").slice(0, 120)
}

export async function createExpenseEntry(month: Date, input: ExpenseEntryInput) {
  const userId = await requireUserId()
  const data = expenseEntrySchema.parse(input)
  const entryMonth = data.uncertain ? currentMonth() : month
  const dueDate =
    !data.uncertain && data.dueDay
      ? resolveDueDate(entryMonth, data.dueDayType, data.dueDay)
      : null
  const paidByName = data.paidBy === "THIRD_PARTY" ? data.paidByName ?? null : null
  await assertOwnedPixKey(userId, data.pixKeyId)

  let entryId: string

  if (data.recurring && !data.uncertain && data.category !== "ONE_OFF") {
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
        paidBy: data.paidBy,
        paidByName,
        paymentMethod: data.paymentMethod,
        pixKeyId: data.pixKeyId ?? null,
        externalLink: cleanExternalLink(data.externalLink),
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
        paidBy: data.paidBy,
        paidByName,
        paymentMethod: data.paymentMethod,
        pixKeyId: data.pixKeyId ?? null,
        externalLink: cleanExternalLink(data.externalLink),
        uncertain: data.uncertain,
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
    },
  })

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

export async function deleteExpenseEntry(id: string) {
  const userId = await requireUserId()
  const result = await deleteExpenseForUser(userId, id)
  revalidatePath("/dashboard", "layout")
  return result
}

export async function saveExpenseReferences(
  id: string,
  input: { externalLink?: string | null }
) {
  const userId = await requireUserId()
  const entry = await prisma.expenseEntry.update({
    where: { id, userId },
    data: { externalLink: cleanExternalLink(input.externalLink) },
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
