import { Prisma } from "@/generated/prisma/client"
import { adjustActualBalance, recalcOpeningBalanceChain } from "@/lib/actions/monthly"
import { addMonths, monthKeyFromDate } from "@/lib/calculations/month"
import { movesOwnMoney } from "@/lib/calculations/balanceChain"
import { prisma } from "@/lib/prisma"
import type { RecurrenceScope } from "@/lib/validation/schemas"

export type DeleteExpenseResult = {
  recurring: boolean
  installmentPlan: boolean
  scope: RecurrenceScope
  deletedEntries: number
}

type DeletedEntry = {
  month: Date
  paid: boolean
  paidBy: "SELF" | "THIRD_PARTY"
  amount: Prisma.Decimal
  paidAmount: Prisma.Decimal | null
}

/**
 * Devolve ao saldo real, mês a mês, o que os lançamentos removidos já haviam
 * pago, e responde qual foi o mês mais antigo afetado, para que a cadeia de
 * aberturas seja recalculada a partir dele.
 */
async function compensatePaidEntries(
  userId: string,
  entries: DeletedEntry[],
  earliestMonth: Date
): Promise<Date> {
  let recalculateFrom = earliestMonth
  const paidByMonth = new Map<string, { month: Date; amount: Prisma.Decimal }>()

  for (const entry of entries) {
    if (entry.month < recalculateFrom) {
      recalculateFrom = entry.month
    }
    // Terceiro nunca entrou no saldo, então apagar não devolve nada.
    if (!entry.paid || !movesOwnMoney(entry)) continue

    const key = monthKeyFromDate(entry.month)
    const amount = entry.paidAmount ?? entry.amount
    const current = paidByMonth.get(key)
    paidByMonth.set(key, {
      month: entry.month,
      amount: current ? current.amount.add(amount) : amount,
    })
  }

  for (const { month, amount } of [...paidByMonth.values()].sort(
    (a, b) => a.month.getTime() - b.month.getTime()
  )) {
    await adjustActualBalance(userId, month, amount)
  }

  return recalculateFrom
}

export async function deleteExpenseForUser(
  userId: string,
  id: string,
  scope: RecurrenceScope
): Promise<DeleteExpenseResult> {
  const existing = await prisma.expenseEntry.findUniqueOrThrow({
    where: { id, userId },
  })
  let recalculateFrom = existing.month
  let deletedEntries = 1

  if (existing.templateId) {
    const templateId = existing.templateId

    if (scope === "ONLY_THIS") {
      // O mês vira exceção do template: sem isso, a materialização recriaria a
      // ocorrência no próximo carregamento do dashboard.
      await prisma.$transaction([
        prisma.expenseEntry.delete({ where: { id, userId } }),
        prisma.expenseTemplateSkip.upsert({
          where: { templateId_month: { templateId, month: existing.month } },
          update: {},
          create: { templateId, month: existing.month },
        }),
      ])

      recalculateFrom = await compensatePaidEntries(userId, [existing], recalculateFrom)
    } else {
      const template = await prisma.expenseTemplate.findUniqueOrThrow({
        where: { id: templateId, userId },
      })
      const doomed = await prisma.expenseEntry.findMany({
        where: { userId, templateId, month: { gte: existing.month } },
      })
      deletedEntries = doomed.length

      // Encerrar no mês anterior preserva o histórico já materializado. Se a
      // exclusão alcança o próprio início da recorrência não sobra nada dela,
      // então o template vai junto.
      const keepsHistory = existing.month > template.startMonth

      await prisma.$transaction([
        prisma.expenseEntry.deleteMany({
          where: { userId, templateId, month: { gte: existing.month } },
        }),
        prisma.expenseTemplateSkip.deleteMany({
          where: { templateId, month: { gte: existing.month } },
        }),
        keepsHistory
          ? prisma.expenseTemplate.update({
              where: { id: templateId, userId },
              data: { endMonth: addMonths(existing.month, -1) },
            })
          : prisma.expenseTemplate.delete({ where: { id: templateId, userId } }),
      ])

      recalculateFrom = await compensatePaidEntries(userId, doomed, recalculateFrom)
    }
  } else if (existing.installmentPlanId) {
    // Um parcelamento é uma dívida só: apagar uma parcela desfaz o acordo
    // inteiro, como apagar uma despesa recorrente apaga a regra.
    const planEntries = await prisma.expenseEntry.findMany({
      where: { userId, installmentPlanId: existing.installmentPlanId },
    })
    deletedEntries = planEntries.length

    // As parcelas caem junto com o plano.
    await prisma.expenseInstallmentPlan.delete({
      where: { id: existing.installmentPlanId, userId },
    })

    recalculateFrom = await compensatePaidEntries(userId, planEntries, recalculateFrom)
  } else {
    const entry = await prisma.expenseEntry.delete({ where: { id, userId } })
    if (entry.paid && movesOwnMoney(entry)) {
      const amount = entry.paidAmount ?? entry.amount
      await adjustActualBalance(userId, entry.month, amount)
    }
  }

  await recalcOpeningBalanceChain(userId, recalculateFrom)

  return {
    recurring: existing.templateId != null,
    installmentPlan: existing.installmentPlanId != null,
    scope,
    deletedEntries,
  }
}
