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
  paidBy: "SELF" | "THIRD_PARTY"
}

/**
 * Se a despesa move o *seu* dinheiro.
 *
 * Conta paga por terceiro fica registrada só para controle: aparece na lista,
 * em cinza, mas não entra em total, saída futura, saldo planejado nem saldo
 * real. Somá-la faria o app cobrar de você um dinheiro que nunca sai da sua
 * conta.
 */
export function movesOwnMoney(expense: { paidBy: "SELF" | "THIRD_PARTY" }): boolean {
  return expense.paidBy !== "THIRD_PARTY"
}

export function computeMonthTotals(incomes: IncomeLike[], expenses: ExpenseLike[]) {
  const totalIncome = sumAmounts(
    incomes
      .filter((income) => !income.uncertain || income.received)
      .map((income) => income.receivedAmount ?? income.amount)
  )
  const totalExpense = sumAmounts(
    expenses
      .filter((expense) => movesOwnMoney(expense) && (!expense.uncertain || expense.paid))
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
      .filter((expense) => movesOwnMoney(expense) && expense.uncertain && !expense.paid)
      .map((expense) => expense.amount)
  )

  return {
    pendingIncome,
    pendingExpense,
    net: pendingIncome.sub(pendingExpense),
  }
}

/**
 * Lançamentos do mês que ainda não aconteceram. Incertos pendentes ficam de
 * fora: eles entram apenas na prévia (`computeUncertainPreview`), como já
 * acontece nos totais do mês. Contá-los aqui os somaria duas vezes, porque o
 * saldo planejado passou a ser construído sobre estes valores.
 */
export function computeOpenCashflow(incomes: IncomeLike[], expenses: ExpenseLike[]) {
  const futureIncome = sumAmounts(
    incomes
      .filter((income) => !income.received && !income.uncertain)
      .map((income) => income.amount)
  )
  const futureExpense = sumAmounts(
    expenses
      .filter((expense) => movesOwnMoney(expense) && !expense.paid && !expense.uncertain)
      .map((expense) => expense.amount)
  )

  return { futureIncome, futureExpense }
}

/**
 * Saldo projetado para o fim do mês.
 *
 * Parte do saldo que já existe hoje na conta (o "Saldo Atual", que os botões
 * Pago/Recebido mantêm atualizado) e aplica só o que ainda falta acontecer.
 * Reconstruir o mês a partir do saldo inicial mais os totais acumulava as
 * imprecisões de todo lançamento já liquidado — em especial quando o valor
 * pago diferia do previsto ou quando o saldo real foi corrigido à mão.
 *
 * Quando o mês ainda não tem saldo atual informado, o chamador passa o saldo
 * inicial: nada foi liquidado, logo os futuros equivalem aos totais e o
 * resultado é o mesmo da regra antiga.
 */
export function computePlannedBalance(
  currentBalance: Prisma.Decimal,
  futureIncome: Prisma.Decimal,
  futureExpense: Prisma.Decimal
): Prisma.Decimal {
  return currentBalance.add(futureIncome).sub(futureExpense)
}
