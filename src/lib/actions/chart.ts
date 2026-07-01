import { prisma } from "@/lib/prisma"
import { computeMonthTotals, computePlannedBalance } from "@/lib/calculations/balanceChain"
import { getCardsMonthSummary } from "@/lib/actions/cardSummary"
import { formatMonthLabel, monthKeyFromDate } from "@/lib/calculations/month"

export type MonthChartPoint = {
  month: string
  label: string
  totalIncome: number
  totalExpense: number
  balance: number
}

export async function getBalanceHistory(userId: string): Promise<MonthChartPoint[]> {
  const balances = await prisma.monthlyBalance.findMany({
    where: { userId },
    orderBy: { month: "asc" },
  })

  return Promise.all(
    balances.map(async (balanceRow) => {
      const [incomes, expenses, cards] = await Promise.all([
        prisma.incomeEntry.findMany({ where: { userId, month: balanceRow.month } }),
        prisma.expenseEntry.findMany({ where: { userId, month: balanceRow.month } }),
        getCardsMonthSummary(userId, balanceRow.month),
      ])

      const { totalIncome, totalExpense: entriesExpense } = computeMonthTotals(incomes, expenses)
      const totalExpense = entriesExpense.add(cards.combinedTotal)
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
