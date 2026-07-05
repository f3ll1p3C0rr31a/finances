import { prisma } from "@/lib/prisma"
import { computeMonthTotals, computePlannedBalance } from "@/lib/calculations/balanceChain"
import { getCardMonthBudget, getCardMonthTotal } from "@/lib/actions/cardSummary"
import { getNonCardSubscriptionsTotal } from "@/lib/actions/subscriptionSummary"
import { ensureMonthGenerated } from "@/lib/actions/monthly"
import { addMonths, formatMonthLabel, monthKeyFromDate } from "@/lib/calculations/month"

export type MonthChartPoint = {
  month: string
  label: string
  totalIncome: number
  totalExpense: number
  balance: number
}

export type BalanceChartRanges = {
  year: MonthChartPoint[]
  nextTwelveMonths: MonthChartPoint[]
}

function formatChartMonthLabel(month: Date): string {
  const monthName = new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    timeZone: "UTC",
  })
    .format(month)
    .replace(".", "")

  return `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)}/${String(
    month.getUTCFullYear()
  ).slice(-2)}`
}

/**
 * Returns two complete dashboard windows relative to the selected month:
 * its full calendar year and a rolling 12-month projection starting there.
 */
export async function getBalanceChartRanges(
  userId: string,
  referenceMonth: Date
): Promise<BalanceChartRanges> {
  const yearStart = new Date(Date.UTC(referenceMonth.getUTCFullYear(), 0, 1))
  const yearEnd = new Date(Date.UTC(referenceMonth.getUTCFullYear(), 11, 1))
  const rollingEnd = addMonths(referenceMonth, 11)

  for (let cursor = yearStart; cursor <= rollingEnd; cursor = addMonths(cursor, 1)) {
    await ensureMonthGenerated(userId, cursor)
  }

  const balances = await prisma.monthlyBalance.findMany({
    where: {
      userId,
      month: {
        gte: yearStart,
        lte: rollingEnd > yearEnd ? rollingEnd : yearEnd,
      },
    },
    orderBy: { month: "asc" },
  })

  const points = await Promise.all(
    balances.map(async (balanceRow) => {
      const [incomes, expenses, cards, nonCardSubscriptions] = await Promise.all([
        prisma.incomeEntry.findMany({ where: { userId, month: balanceRow.month } }),
        prisma.expenseEntry.findMany({ where: { userId, month: balanceRow.month } }),
        getCardMonthBudget(userId, balanceRow.month),
        getNonCardSubscriptionsTotal(userId, balanceRow.month),
      ])

      const { totalIncome, totalExpense: entriesExpense } = computeMonthTotals(incomes, expenses)
      const totalExpense = entriesExpense.add(cards.plannedTotal).add(nonCardSubscriptions)
      const plannedBalance = computePlannedBalance(
        balanceRow.openingBalance,
        totalIncome,
        totalExpense
      )
      const balance = balanceRow.actualBalance ?? plannedBalance

      return {
        month: monthKeyFromDate(balanceRow.month),
        label: formatChartMonthLabel(balanceRow.month),
        totalIncome: totalIncome.toNumber(),
        totalExpense: totalExpense.toNumber(),
        balance: balance.toNumber(),
      }
    })
  )

  return {
    year: points.filter(
      (point) => point.month >= monthKeyFromDate(yearStart) && point.month <= monthKeyFromDate(yearEnd)
    ),
    nextTwelveMonths: points.filter(
      (point) =>
        point.month >= monthKeyFromDate(referenceMonth) &&
        point.month <= monthKeyFromDate(rollingEnd)
    ),
  }
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
