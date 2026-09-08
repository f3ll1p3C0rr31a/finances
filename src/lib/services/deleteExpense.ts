import { Prisma } from "@/generated/prisma/client"
import { adjustActualBalance, recalcOpeningBalanceChain } from "@/lib/actions/monthly"
import { monthKeyFromDate } from "@/lib/calculations/month"
import { movesOwnMoney } from "@/lib/calculations/balanceChain"
import { prisma } from "@/lib/prisma"

export type DeleteExpenseResult = {
  recurring: boolean
  installmentPlan: boolean
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
  id: string
): Promise<DeleteExpenseResult> {
  const existing = await prisma.expenseEntry.findUniqueOrThrow({
    where: { id, userId },
  })
  let recalculateFrom = existing.month
  let deletedEntries = 1

  if (existing.templateId) {
    const recurringEntries = await prisma.expenseEntry.findMany({
      where: { userId, templateId: existing.templateId },
    })
    deletedEntries = recurringEntries.length

    await prisma.$transaction([
      prisma.expenseEntry.deleteMany({
        where: { userId, templateId: existing.templateId },
      }),
      prisma.expenseTemplate.delete({
        where: { id: existing.templateId, userId },
      }),
    ])

    recalculateFrom = await compensatePaidEntries(userId, recurringEntries, recalculateFrom)
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
    deletedEntries,
  }
}
