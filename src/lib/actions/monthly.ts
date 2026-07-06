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
} from "@/lib/calculations/balanceChain"
import { getCardMonthBudget } from "@/lib/actions/cardSummary"
import { getNonCardSubscriptionsTotal } from "@/lib/actions/subscriptionSummary"

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

async function plannedClosingBalance(
  userId: string,
  balanceRow: { month: Date; openingBalance: Prisma.Decimal }
): Promise<Prisma.Decimal> {
  const [incomes, expenses, cards, nonCardSubscriptions] = await Promise.all([
    prisma.incomeEntry.findMany({ where: { userId, month: balanceRow.month } }),
    prisma.expenseEntry.findMany({ where: { userId, month: balanceRow.month } }),
    getCardMonthBudget(userId, balanceRow.month),
    getNonCardSubscriptionsTotal(userId, balanceRow.month),
  ])
  const { totalIncome, totalExpense: entriesExpense } = computeMonthTotals(incomes, expenses)
  const totalExpense = entriesExpense.add(cards.plannedTotal).add(nonCardSubscriptions)
  return computePlannedBalance(balanceRow.openingBalance, totalIncome, totalExpense)
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
  let runningOpening =
    previousAnchor.actualBalance ?? (await plannedClosingBalance(userId, previousAnchor))

  for (;;) {
    await ensureTemplateEntries(userId, cursor)
    const row = await prisma.monthlyBalance.upsert({
      where: { userId_month: { userId, month: cursor } },
      update: {},
      create: { userId, month: cursor, openingBalance: runningOpening },
    })
    if (cursor.getTime() === month.getTime()) break
    runningOpening = row.actualBalance ?? (await plannedClosingBalance(userId, row))
    cursor = addMonths(cursor, 1)
  }
}

/**
 * Propagates a month's actual (or planned) closing balance forward into the
 * opening balance of already-materialized future months, stopping as soon as
 * a month's opening balance doesn't need to change.
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

    const newOpening = current.actualBalance ?? (await plannedClosingBalance(userId, current))
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
    .add(cards.reserve)
    .add(nonCardSubscriptions)
  const difference = totalIncome.sub(totalExpense)
  const plannedBalance = computePlannedBalance(balance.openingBalance, totalIncome, totalExpense)
  const previewBalance = plannedBalance.add(uncertainPreview.net)
  const closingBalance = balance.actualBalance ?? plannedBalance

  return {
    incomeEntries,
    expenseEntries,
    cardSummaries: cards.summaries,
    cardsTotal: cards.combinedTotal,
    cardReserve: cards.reserve,
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
