import { prisma } from "@/lib/prisma"
import { computeMonthTotals, computePlannedBalance } from "@/lib/calculations/balanceChain"
import { getCardsMonthSummary, getCardMonthTotal } from "@/lib/actions/cardSummary"
import { getNonCardSubscriptionsTotal } from "@/lib/actions/subscriptionSummary"
import { ensureMonthGenerated } from "@/lib/actions/monthly"
import { addMonths, currentMonth, formatMonthLabel, monthKeyFromDate } from "@/lib/calculations/month"

export type MonthChartPoint = {
  month: string
  label: string
  totalIncome: number
  totalExpense: number
  balance: number
}

/**
 * Returns the full monthly history plus a rolling 12-month forward window
 * from today, materializing future months on demand so the dashboard chart
 * always has data for the year ahead.
 */
export async function getBalanceHistory(userId: string): Promise<MonthChartPoint[]> {
  await ensureMonthGenerated(userId, addMonths(currentMonth(), 11))

  const balances = await prisma.monthlyBalance.findMany({
    where: { userId },
    orderBy: { month: "asc" },
  })

  return Promise.all(
    balances.map(async (balanceRow) => {
      const [incomes, expenses, cards, nonCardSubscriptions] = await Promise.all([
        prisma.incomeEntry.findMany({ where: { userId, month: balanceRow.month } }),
        prisma.expenseEntry.findMany({ where: { userId, month: balanceRow.month } }),
        getCardsMonthSummary(userId, balanceRow.month),
        getNonCardSubscriptionsTotal(userId, balanceRow.month),
      ])

      const { totalIncome, totalExpense: entriesExpense } = computeMonthTotals(incomes, expenses)
      const totalExpense = entriesExpense.add(cards.combinedTotal).add(nonCardSubscriptions)
      const plannedBalance = computePlannedBalance(
        balanceRow.openingBalance,
        totalIncome,
        totalExpense
      )
      const balance = balanceRow.actualBalance ?? plannedBalance

      return {
        month: monthKeyFromDate(balanceRow.month),
        label: formatMonthLabel(balanceRow.month),
        totalIncome: totalIncome.toNumber(),
        totalExpense: totalExpense.toNumber(),
        balance: balance.toNumber(),
      }
    })
  )
}

export type CardMonthChartPoint = {
  month: string
  label: string
  total: number
}

/**
 * Per-card monthly spending history, spanning from the card's earliest
 * purchase through the last month with a pending installment (installments
 * are already materialized for every future slice at purchase time).
 */
export async function getCardMonthlyHistory(
  userId: string,
  cardId: string
): Promise<CardMonthChartPoint[]> {
  const [purchases, installments] = await Promise.all([
    prisma.cardPurchase.findMany({ where: { cardId }, select: { purchaseDate: true } }),
    prisma.cardInstallment.findMany({ where: { purchase: { cardId } }, select: { month: true } }),
  ])

  if (purchases.length === 0) return []

  const purchaseMonths = purchases.map(
    (p) => new Date(Date.UTC(p.purchaseDate.getUTCFullYear(), p.purchaseDate.getUTCMonth(), 1))
  )
  const allMonths = [...purchaseMonths, ...installments.map((i) => i.month)]
  const start = allMonths.reduce((min, d) => (d < min ? d : min), allMonths[0])
  const end = allMonths.reduce((max, d) => (d > max ? d : max), allMonths[0])

  const months: Date[] = []
  for (let cursor = start; cursor <= end; cursor = addMonths(cursor, 1)) {
    months.push(cursor)
  }

  const totals = await Promise.all(months.map((month) => getCardMonthTotal(userId, cardId, month)))

  return months.map((month, i) => ({
    month: monthKeyFromDate(month),
    label: formatMonthLabel(month),
    total: totals[i].toNumber(),
  }))
}
