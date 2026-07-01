import { Prisma } from "@/generated/prisma/client"

import { sumAmounts } from "./money"

type IncomeLike = { amount: Prisma.Decimal; receivedAmount: Prisma.Decimal | null }
type ExpenseLike = { amount: Prisma.Decimal; paidAmount: Prisma.Decimal | null }

export function computeMonthTotals(incomes: IncomeLike[], expenses: ExpenseLike[]) {
  const totalIncome = sumAmounts(incomes.map((i) => i.receivedAmount ?? i.amount))
  const totalExpense = sumAmounts(expenses.map((e) => e.paidAmount ?? e.amount))
  const difference = totalIncome.sub(totalExpense)
  return { totalIncome, totalExpense, difference }
}

export function computePlannedBalance(
  opening: Prisma.Decimal,
  totalIncome: Prisma.Decimal,
  totalExpense: Prisma.Decimal
): Prisma.Decimal {
  return opening.add(totalIncome).sub(totalExpense)
}
