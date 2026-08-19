import { Prisma } from "@/generated/prisma/client"

import { prisma } from "@/lib/prisma"
import { addMonths } from "@/lib/calculations/month"
import { sumAmounts } from "@/lib/calculations/money"
import { computeGoalProgress } from "@/lib/calculations/goalProgress"
import { openInvoiceMonth } from "@/lib/calculations/cardTiming"
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

/**
 * Resumo da fatura que está aberta em cada cartão. Cada cartão tem o seu
 * próprio ciclo, então o mês de faturamento é resolvido cartão a cartão em vez
 * de usar um mês comum: depois do fechamento, o cartão já mostra a fatura que
 * está acumulando, e não a que fechou.
 */
export async function getCardsOpenInvoiceSummary(userId: string) {
  const cards = await prisma.card.findMany({
    where: { userId, active: true },
    orderBy: { name: "asc" },
    include: { account: true },
  })

  const summaries = await Promise.all(
    cards.map(async (card) => {
      const month = openInvoiceMonth(card)
      const [total, payment] = await Promise.all([
        getCardMonthTotal(userId, card.id, month, card),
        prisma.cardInvoicePayment.findUnique({
          where: { cardId_month: { cardId: card.id, month } },
        }),
      ])
      return { card, month, total, paid: payment?.paid ?? false }
    })
  )

  return { summaries, combinedTotal: sumAmounts(summaries.map((s) => s.total)) }
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
