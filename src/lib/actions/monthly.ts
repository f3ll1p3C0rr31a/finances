import { Prisma } from "@/generated/prisma/client"

import { prisma } from "@/lib/prisma"
import { addMonths, currentMonth } from "@/lib/calculations/month"
import { resolveDueDate } from "@/lib/calculations/businessDay"
import { sumAmounts } from "@/lib/calculations/money"
import {
  computeOpenCashflow,
  computeMonthTotals,
  computePlannedBalance,
  computeUncertainPreview,
  openingForNextMonth,
} from "@/lib/calculations/balanceChain"
import { getCardMonthBudget } from "@/lib/actions/cardSummary"
import { getNonCardSubscriptionsTotal } from "@/lib/actions/subscriptionSummary"
import { ensureSubscriptionChargesGenerated } from "@/lib/services/subscriptionCharges"

async function ensureTemplateEntries(userId: string, month: Date) {
  const incomeTemplates = await prisma.incomeTemplate.findMany({
    where: {
      userId,
      active: true,
      startMonth: { lte: month },
      OR: [{ endMonth: null }, { endMonth: { gte: month } }],
    },
  })

  for (const template of incomeTemplates) {
    await prisma.incomeEntry.upsert({
      where: { templateId_month: { templateId: template.id, month } },
      update: {},
      create: {
        userId,
        templateId: template.id,
        name: template.name,
        month,
        dueDate: template.dayOfMonth
          ? resolveDueDate(month, template.dueDayType, template.dayOfMonth)
          : null,
        dueDayType: template.dueDayType,
        dueDayValue: template.dayOfMonth,
        amount: template.defaultAmount,
      },
    })
  }

  const expenseTemplates = await prisma.expenseTemplate.findMany({
    where: {
      userId,
      active: true,
      startMonth: { lte: month },
      OR: [{ endMonth: null }, { endMonth: { gte: month } }],
    },
  })

  for (const template of expenseTemplates) {
    await prisma.expenseEntry.upsert({
      where: { templateId_month: { templateId: template.id, month } },
      update: {},
      create: {
        userId,
        templateId: template.id,
        name: template.name,
        category: template.category,
        month,
        dueDate: template.dayOfMonth
          ? resolveDueDate(month, template.dueDayType, template.dayOfMonth)
          : null,
        dueDayType: template.dueDayType,
        dueDayValue: template.dayOfMonth,
        amount: template.defaultAmount ?? new Prisma.Decimal(0),
      },
    })
  }
}

async function rollPendingUncertainEntries(userId: string): Promise<void> {
  const targetMonth = currentMonth()

  await Promise.all([
    prisma.incomeEntry.updateMany({
      where: {
        userId,
        uncertain: true,
        received: false,
        month: { lt: targetMonth },
      },
      data: {
        month: targetMonth,
        dueDate: null,
        dueDayValue: null,
      },
    }),
    prisma.expenseEntry.updateMany({
      where: {
        userId,
        uncertain: true,
        paid: false,
        month: { lt: targetMonth },
      },
      data: {
        month: targetMonth,
        dueDate: null,
        dueDayValue: null,
      },
    }),
  ])
}

type BalanceRow = {
  month: Date
  openingBalance: Prisma.Decimal
  actualBalance: Prisma.Decimal | null
}

/**
 * Tudo que ainda falta acontecer no mês: entradas não recebidas, despesas não
 * pagas, faturas de cartão em aberto, a reserva da meta dos cartões e as
 * assinaturas fora de cartão. É a única parte que o saldo planejado aplica
 * sobre o saldo atual, então a mesma composição precisa valer para a cadeia de
 * saldos e para o painel do mês.
 */
export async function getMonthOpenCashflow(userId: string, month: Date) {
  const [incomes, expenses, cards, nonCardSubscriptions] = await Promise.all([
    prisma.incomeEntry.findMany({ where: { userId, month } }),
    prisma.expenseEntry.findMany({ where: { userId, month } }),
    getCardMonthBudget(userId, month),
    getNonCardSubscriptionsTotal(userId, month),
  ])
  const openCashflow = computeOpenCashflow(incomes, expenses)
  const pendingCardInvoices = sumAmounts(
    cards.summaries.filter((summary) => !summary.paid).map((summary) => summary.total)
  )

  return {
    futureIncome: openCashflow.futureIncome,
    futureExpense: openCashflow.futureExpense
      .add(pendingCardInvoices)
      .add(cards.appliedReserve)
      .add(nonCardSubscriptions),
  }
}

/**
 * Projeção de fechamento do mês: saldo atual (ou inicial, se ainda não houver)
 * mais o que falta acontecer. É o que o painel mostra como "Saldo planejado".
 */
async function plannedClosingBalance(
  userId: string,
  balanceRow: BalanceRow
): Promise<Prisma.Decimal> {
  const { futureIncome, futureExpense } = await getMonthOpenCashflow(userId, balanceRow.month)
  return computePlannedBalance(
    balanceRow.actualBalance ?? balanceRow.openingBalance,
    futureIncome,
    futureExpense
  )
}

/**
 * Saldo inicial que `balanceRow` entrega ao mês seguinte; a regra está em
 * `openingForNextMonth()`. Aqui só se resolve a alternativa — o fechamento
 * planejado custa várias consultas e não entra na conta quando o mês já tem
 * saldo atual, então só é buscado nesse caso.
 */
async function carryOverBalance(
  userId: string,
  balanceRow: BalanceRow
): Promise<Prisma.Decimal> {
  const { actualBalance } = balanceRow
  const plannedClosing = actualBalance ?? (await plannedClosingBalance(userId, balanceRow))
  return openingForNextMonth(actualBalance, plannedClosing)
}

/**
 * Guarantees that the recurring templates for `month` have been materialized
 * into concrete entries, and that a MonthlyBalance row exists for it, walking
 * forward from the most recent existing month so the opening-balance chain
 * never breaks. Idempotent: re-running never overwrites user edits.
 */
export async function ensureMonthGenerated(userId: string, month: Date): Promise<void> {
  await ensureTemplateEntries(userId, month)

  const existing = await prisma.monthlyBalance.findUnique({
    where: { userId_month: { userId, month } },
  })
  if (existing) return

  const previousAnchor = await prisma.monthlyBalance.findFirst({
    where: { userId, month: { lt: month } },
    orderBy: { month: "desc" },
  })

  if (!previousAnchor) {
    await prisma.monthlyBalance.create({
      data: { userId, month, openingBalance: new Prisma.Decimal(0) },
    })
    return
  }

  let cursor = addMonths(previousAnchor.month, 1)
  let runningOpening = await carryOverBalance(userId, previousAnchor)

  for (;;) {
    await ensureTemplateEntries(userId, cursor)
    const row = await prisma.monthlyBalance.upsert({
      where: { userId_month: { userId, month: cursor } },
      update: {},
      create: { userId, month: cursor, openingBalance: runningOpening },
    })
    if (cursor.getTime() === month.getTime()) break
    runningOpening = await carryOverBalance(userId, row)
    cursor = addMonths(cursor, 1)
  }
}

/**
 * Propaga o saldo de virada de um mês para a abertura dos meses futuros já
 * materializados, parando assim que uma abertura não precisa mudar.
 */
export async function recalcOpeningBalanceChain(userId: string, fromMonth: Date): Promise<void> {
  let cursor = fromMonth

  for (;;) {
    const current = await prisma.monthlyBalance.findUnique({
      where: { userId_month: { userId, month: cursor } },
    })
    if (!current) return

    const nextMonth = addMonths(cursor, 1)
    const next = await prisma.monthlyBalance.findUnique({
      where: { userId_month: { userId, month: nextMonth } },
    })
    if (!next) return

    const newOpening = await carryOverBalance(userId, current)
    if (next.openingBalance.equals(newOpening)) return

    await prisma.monthlyBalance.update({
      where: { id: next.id },
      data: { openingBalance: newOpening },
    })
    cursor = nextMonth
  }
}

/**
 * Nudges a month's current balance by `delta`. If it has not been initialized
 * yet, the opening balance is used as the starting point so the first
 * paid/received toggle is never silently ignored.
 */
export async function adjustActualBalance(
  userId: string,
  month: Date,
  delta: Prisma.Decimal
): Promise<void> {
  const balance = await prisma.monthlyBalance.findUnique({
    where: { userId_month: { userId, month } },
  })
  if (!balance) return

  await prisma.monthlyBalance.update({
    where: { id: balance.id },
    data: {
      actualBalance: (balance.actualBalance ?? balance.openingBalance).add(delta),
      actualBalanceAt: new Date(),
    },
  })
  await recalcOpeningBalanceChain(userId, month)
}

export async function getMonthData(userId: string, month: Date) {
  await rollPendingUncertainEntries(userId)
  await ensureSubscriptionChargesGenerated(userId)
  await ensureMonthGenerated(userId, month)

  const [incomeEntries, expenseEntries, balance, cards, nonCardSubscriptions] = await Promise.all([
    prisma.incomeEntry.findMany({
      where: { userId, month },
      orderBy: { name: "asc" },
      include: { tags: { include: { tag: true } } },
    }),
    prisma.expenseEntry.findMany({
      where: { userId, month },
      orderBy: { name: "asc" },
      include: { tags: { include: { tag: true } }, pixKey: true },
    }),
    prisma.monthlyBalance.findUniqueOrThrow({ where: { userId_month: { userId, month } } }),
    getCardMonthBudget(userId, month),
    getNonCardSubscriptionsTotal(userId, month),
  ])

  const { totalIncome, totalExpense: entriesExpense } = computeMonthTotals(incomeEntries, expenseEntries)
  const openCashflow = computeOpenCashflow(incomeEntries, expenseEntries)
  const uncertainPreview = computeUncertainPreview(incomeEntries, expenseEntries)
  const totalExpense = entriesExpense.add(cards.plannedTotal).add(nonCardSubscriptions)
  const pendingCardInvoices = sumAmounts(
    cards.summaries.filter((summary) => !summary.paid).map((summary) => summary.total)
  )
  const futureExpense = openCashflow.futureExpense
    .add(pendingCardInvoices)
    .add(cards.appliedReserve)
    .add(nonCardSubscriptions)
  const difference = totalIncome.sub(totalExpense)
  const plannedBalance = computePlannedBalance(
    balance.actualBalance ?? balance.openingBalance,
    openCashflow.futureIncome,
    futureExpense
  )
  const previewBalance = plannedBalance.add(uncertainPreview.net)
  const closingBalance = balance.actualBalance ?? plannedBalance

  return {
    incomeEntries,
    expenseEntries,
    cardSummaries: cards.summaries,
    cardsTotal: cards.combinedTotal,
    cardReserve: cards.appliedReserve,
    nonCardSubscriptionsTotal: nonCardSubscriptions,
    balance,
    totalIncome,
    totalExpense,
    futureIncome: openCashflow.futureIncome,
    futureExpense,
    difference,
    plannedBalance,
    previewBalance,
    pendingUncertainIncome: uncertainPreview.pendingIncome,
    pendingUncertainExpense: uncertainPreview.pendingExpense,
    closingBalance,
  }
}
