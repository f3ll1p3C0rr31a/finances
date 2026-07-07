import { prisma } from "@/lib/prisma"
import {
  computeMonthTotals,
  computeOpenCashflow,
  computePlannedBalance,
} from "@/lib/calculations/balanceChain"
import { getCardMonthBudget, getCardMonthTotal } from "@/lib/actions/cardSummary"
import { getNonCardSubscriptionsForMonth } from "@/lib/actions/subscriptionSummary"
import { ensureMonthGenerated } from "@/lib/actions/monthly"
import { addMonths, formatMonthLabel, monthKeyFromDate } from "@/lib/calculations/month"
import { sumAmounts } from "@/lib/calculations/money"

export type MonthlyBreakdownItem = {
  key: string
  label: string
  group: "card" | "income" | "expense"
  value: number
}

export type MonthChartPoint = {
  month: string
  label: string
  totalIncome: number
  totalExpense: number
  futureIncome: number
  futureExpense: number
  balance: number
  openingBalance: number
  plannedBalance: number
  breakdown: MonthlyBreakdownItem[]
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
        getNonCardSubscriptionsForMonth(userId, balanceRow.month),
      ])

      const { totalIncome, totalExpense: entriesExpense } = computeMonthTotals(incomes, expenses)
      const openCashflow = computeOpenCashflow(incomes, expenses)
      const subscriptionsTotal = sumAmounts(nonCardSubscriptions.map((sub) => sub.amount))
      const totalExpense = entriesExpense.add(cards.plannedTotal).add(subscriptionsTotal)
      const pendingCardInvoices = sumAmounts(
        cards.summaries.filter((summary) => !summary.paid).map((summary) => summary.total)
      )
      const futureExpense = openCashflow.futureExpense
        .add(pendingCardInvoices)
        .add(cards.appliedReserve)
        .add(subscriptionsTotal)
      const plannedBalance = computePlannedBalance(
        balanceRow.openingBalance,
        totalIncome,
        totalExpense
      )
      const balance = balanceRow.actualBalance ?? plannedBalance
      const breakdown: MonthlyBreakdownItem[] = [
        ...cards.summaries.map((summary) => ({
          key: `card:${summary.card.id}`,
          label: summary.card.name,
          group: "card" as const,
          value: summary.total.neg().toNumber(),
        })),
        ...(cards.appliedReserve.gt(0)
          ? [
              {
                key: "card:reserve",
                label: "Reserva da meta dos cartões",
                group: "card" as const,
                value: cards.appliedReserve.neg().toNumber(),
              },
            ]
          : []),
        ...incomes
          .filter((income) => !income.uncertain || income.received)
          .map((income) => ({
            key: `income:${income.name}`,
            label: income.name,
            group: "income" as const,
            value: (income.receivedAmount ?? income.amount).toNumber(),
          })),
        ...expenses
          .filter((expense) => !expense.uncertain || expense.paid)
          .map((expense) => ({
            key: `expense:${expense.name}`,
            label: expense.name,
            group: "expense" as const,
            value: (expense.paidAmount ?? expense.amount).neg().toNumber(),
          })),
        ...nonCardSubscriptions.map((subscription) => ({
          key: `expense:subscription:${subscription.id}`,
          label: subscription.name,
          group: "expense" as const,
          value: subscription.amount.neg().toNumber(),
        })),
      ]

      return {
        month: monthKeyFromDate(balanceRow.month),
        label: formatChartMonthLabel(balanceRow.month),
        totalIncome: totalIncome.toNumber(),
        totalExpense: totalExpense.toNumber(),
        futureIncome: openCashflow.futureIncome.toNumber(),
        futureExpense: futureExpense.toNumber(),
        balance: balance.toNumber(),
        openingBalance: balanceRow.openingBalance.toNumber(),
        plannedBalance: plannedBalance.toNumber(),
        breakdown,
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
    prisma.cardPurchase.findMany({
      where: { cardId },
      select: { purchaseDate: true, billingMonth: true },
    }),
    prisma.cardInstallment.findMany({ where: { purchase: { cardId } }, select: { month: true } }),
  ])

  if (purchases.length === 0) return []

  const purchaseMonths = purchases.map(
    (p) =>
      p.billingMonth ??
      new Date(Date.UTC(p.purchaseDate.getUTCFullYear(), p.purchaseDate.getUTCMonth(), 1))
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

export async function getCardMonthlyWindow(
  userId: string,
  cardId: string,
  startMonth: Date,
  monthCount = 12
): Promise<CardMonthChartPoint[]> {
  const months = Array.from({ length: monthCount }, (_, index) => addMonths(startMonth, index))
  const totals = await Promise.all(months.map((month) => getCardMonthTotal(userId, cardId, month)))

  return months.map((month, index) => ({
    month: monthKeyFromDate(month),
    label: formatMonthLabel(month),
    total: totals[index].toNumber(),
  }))
}
