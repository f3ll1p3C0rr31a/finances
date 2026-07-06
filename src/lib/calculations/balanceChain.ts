import { Prisma } from "@/generated/prisma/client"

import { sumAmounts } from "./money"

type IncomeLike = {
  amount: Prisma.Decimal
  receivedAmount: Prisma.Decimal | null
  received: boolean
  uncertain: boolean
}
type ExpenseLike = {
  amount: Prisma.Decimal
  paidAmount: Prisma.Decimal | null
  paid: boolean
  uncertain: boolean
}

export function computeMonthTotals(incomes: IncomeLike[], expenses: ExpenseLike[]) {
  const totalIncome = sumAmounts(
    incomes
      .filter((income) => !income.uncertain || income.received)
      .map((income) => income.receivedAmount ?? income.amount)
  )
  const totalExpense = sumAmounts(
    expenses
      .filter((expense) => !expense.uncertain || expense.paid)
      .map((expense) => expense.paidAmount ?? expense.amount)
  )
  const difference = totalIncome.sub(totalExpense)
  return { totalIncome, totalExpense, difference }
}

export function computeUncertainPreview(incomes: IncomeLike[], expenses: ExpenseLike[]) {
  const pendingIncome = sumAmounts(
    incomes
      .filter((income) => income.uncertain && !income.received)
      .map((income) => income.amount)
  )
  const pendingExpense = sumAmounts(
    expenses
      .filter((expense) => expense.uncertain && !expense.paid)
      .map((expense) => expense.amount)
  )

  return {
    pendingIncome,
    pendingExpense,
    net: pendingIncome.sub(pendingExpense),
  }
}

export function computeOpenCashflow(incomes: IncomeLike[], expenses: ExpenseLike[]) {
  const futureIncome = sumAmounts(
    incomes
      .filter((income) => !income.received)
      .map((income) => income.amount)
  )
  const futureExpense = sumAmounts(
    expenses
      .filter((expense) => !expense.paid)
      .map((expense) => expense.amount)
  )

  return { futureIncome, futureExpense }
}

export function computePlannedBalance(
  opening: Prisma.Decimal,
  totalIncome: Prisma.Decimal,
  totalExpense: Prisma.Decimal
): Prisma.Decimal {
  return opening.add(totalIncome).sub(totalExpense)
}
