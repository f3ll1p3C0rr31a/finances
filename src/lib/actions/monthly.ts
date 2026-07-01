import { Prisma } from "@/generated/prisma/client"

import { prisma } from "@/lib/prisma"
import { addMonths, dateWithDay } from "@/lib/calculations/month"
import { computeMonthTotals, computePlannedBalance } from "@/lib/calculations/balanceChain"

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
        dueDate: template.dayOfMonth ? dateWithDay(month, template.dayOfMonth) : null,
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
        dueDate: template.dayOfMonth ? dateWithDay(month, template.dayOfMonth) : null,
        amount: template.defaultAmount ?? new Prisma.Decimal(0),
      },
    })
  }
}

async function plannedClosingBalance(
  userId: string,
  balanceRow: { month: Date; openingBalance: Prisma.Decimal }
): Promise<Prisma.Decimal> {
  const [incomes, expenses] = await Promise.all([
    prisma.incomeEntry.findMany({ where: { userId, month: balanceRow.month } }),
    prisma.expenseEntry.findMany({ where: { userId, month: balanceRow.month } }),
  ])
  const { totalIncome, totalExpense } = computeMonthTotals(incomes, expenses)
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

export async function getMonthData(userId: string, month: Date) {
  await ensureMonthGenerated(userId, month)

  const [incomeEntries, expenseEntries, balance] = await Promise.all([
    prisma.incomeEntry.findMany({ where: { userId, month }, orderBy: { name: "asc" } }),
    prisma.expenseEntry.findMany({ where: { userId, month }, orderBy: { name: "asc" } }),
    prisma.monthlyBalance.findUniqueOrThrow({ where: { userId_month: { userId, month } } }),
  ])

  const { totalIncome, totalExpense, difference } = computeMonthTotals(incomeEntries, expenseEntries)
  const plannedBalance = computePlannedBalance(balance.openingBalance, totalIncome, totalExpense)
  const closingBalance = balance.actualBalance ?? plannedBalance

  return {
    incomeEntries,
    expenseEntries,
    balance,
    totalIncome,
    totalExpense,
    difference,
    plannedBalance,
    closingBalance,
  }
}
