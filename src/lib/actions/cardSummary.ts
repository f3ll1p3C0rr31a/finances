import { Prisma } from "@/generated/prisma/client"

import { prisma } from "@/lib/prisma"
import { addMonths } from "@/lib/calculations/month"
import { sumAmounts } from "@/lib/calculations/money"
import { computeGoalProgress } from "@/lib/calculations/goalProgress"
import { getCardSubscriptionsTotal } from "@/lib/actions/subscriptionSummary"

export async function getCardMonthTotal(
  userId: string,
  cardId: string,
  month: Date,
  cycle?: { closingDay: number | null; paymentDay: number | null }
): Promise<Prisma.Decimal> {
  const nextMonth = addMonths(month, 1)

  const [installments, singlePurchases, subscriptionsTotal] = await Promise.all([
    prisma.cardInstallment.findMany({ where: { month, purchase: { cardId } } }),
    prisma.cardPurchase.findMany({
      where: {
        cardId,
        installmentCount: 1,
        OR: [
          { billingMonth: month },
          { billingMonth: null, purchaseDate: { gte: month, lt: nextMonth } },
        ],
      },
    }),
    getCardSubscriptionsTotal(userId, cardId, month, cycle),
  ])

  return sumAmounts([
    ...installments.map((i) => i.amount),
    ...singlePurchases.map((p) => p.totalAmount),
    subscriptionsTotal,
  ])
}

export async function getCardsMonthSummary(userId: string, month: Date) {
  const cards = await prisma.card.findMany({
    where: { userId, active: true },
    orderBy: { name: "asc" },
    include: {
      account: true,
      invoicePayments: {
        where: { month },
        take: 1,
      },
    },
  })

  const summaries = await Promise.all(
    cards.map(async (card) => ({
      card,
      total: await getCardMonthTotal(userId, card.id, month, card),
      paid: card.invoicePayments[0]?.paid ?? false,
    }))
  )

  const combinedTotal = sumAmounts(summaries.map((s) => s.total))

  return { summaries, combinedTotal }
}

export async function getCardMonthBudget(userId: string, month: Date) {
  const projectionMonth = addMonths(month, 1)
  const previousGoalMonth = addMonths(month, -1)
  const [{ summaries, combinedTotal }, projected, goalRow, previousGoalRow] = await Promise.all([
    getCardsMonthSummary(userId, month),
    getCardsMonthSummary(userId, projectionMonth),
    prisma.cardSpendingGoal.findFirst({
      where: { userId, month: { lte: month } },
      orderBy: { month: "desc" },
    }),
    prisma.cardSpendingGoal.findFirst({
      where: { userId, month: { lte: previousGoalMonth } },
      orderBy: { month: "desc" },
    }),
  ])

  const goal = goalRow?.amount ?? new Prisma.Decimal(0)
  const reserve = goal.gt(projected.combinedTotal)
    ? goal.sub(projected.combinedTotal)
    : new Prisma.Decimal(0)
  const previousGoal = previousGoalRow?.amount ?? new Prisma.Decimal(0)
  const appliedReserve = previousGoal.gt(combinedTotal)
    ? previousGoal.sub(combinedTotal)
    : new Prisma.Decimal(0)
  const plannedTotal = combinedTotal.add(appliedReserve)

  return {
    summaries,
    combinedTotal,
    projectedSummaries: projected.summaries,
    projectedCombinedTotal: projected.combinedTotal,
    projectionMonth,
    goal: goalRow?.amount ?? null,
    reserve,
    appliedReserve,
    plannedTotal,
  }
}

export async function getCardGoalData(userId: string, month: Date) {
  const budget = await getCardMonthBudget(userId, month)
  const goal = budget.goal ?? new Prisma.Decimal(0)
  const progress = computeGoalProgress(goal, budget.projectedCombinedTotal, month)

  return { ...budget, progress }
}
