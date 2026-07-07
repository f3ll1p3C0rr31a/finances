import { Prisma } from "@/generated/prisma/client"

import { prisma } from "@/lib/prisma"
import { addMonths } from "@/lib/calculations/month"
import { sumAmounts } from "@/lib/calculations/money"
import { computeGoalProgress } from "@/lib/calculations/goalProgress"
import { getCardSubscriptionsTotal } from "@/lib/actions/subscriptionSummary"

export async function getCardMonthTotal(
  userId: string,
  cardId: string,
  month: Date
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
    getCardSubscriptionsTotal(userId, cardId, month),
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
      invoicePayments: {
        where: { month },
        take: 1,
      },
    },
  })

  const summaries = await Promise.all(
    cards.map(async (card) => ({
      card,
      total: await getCardMonthTotal(userId, card.id, month),
      paid: card.invoicePayments[0]?.paid ?? false,
    }))
  )

  const combinedTotal = sumAmounts(summaries.map((s) => s.total))

  return { summaries, combinedTotal }
}

export async function getCardMonthBudget(userId: string, month: Date) {
  const projectionMonth = addMonths(month, 1)
  const [{ summaries, combinedTotal }, projected, goalRow] = await Promise.all([
    getCardsMonthSummary(userId, month),
    getCardsMonthSummary(userId, projectionMonth),
    prisma.cardSpendingGoal.findUnique({ where: { userId_month: { userId, month } } }),
  ])

  const goal = goalRow?.amount ?? new Prisma.Decimal(0)
  const reserve = goal.gt(projected.combinedTotal)
    ? goal.sub(projected.combinedTotal)
    : new Prisma.Decimal(0)
  const plannedTotal = combinedTotal.add(reserve)

  return {
    summaries,
    combinedTotal,
    projectedSummaries: projected.summaries,
    projectedCombinedTotal: projected.combinedTotal,
    projectionMonth,
    goal: goalRow?.amount ?? null,
    reserve,
    plannedTotal,
  }
}

export async function getCardGoalData(userId: string, month: Date) {
  const budget = await getCardMonthBudget(userId, month)
  const goal = budget.goal ?? new Prisma.Decimal(0)
  const progress = computeGoalProgress(goal, budget.projectedCombinedTotal, month)

  return { ...budget, progress }
}
