import { Prisma } from "@/generated/prisma/client"
import { adjustActualBalance, recalcOpeningBalanceChain } from "@/lib/actions/monthly"
import { monthKeyFromDate } from "@/lib/calculations/month"
import { prisma } from "@/lib/prisma"

export type DeleteExpenseResult = {
  recurring: boolean
  deletedEntries: number
}

export async function deleteExpenseForUser(
  userId: string,
  id: string
): Promise<DeleteExpenseResult> {
  const existing = await prisma.expenseEntry.findUniqueOrThrow({
    where: { id, userId },
  })
  let recalculateFrom = existing.month
  let deletedEntries = 1

  if (existing.templateId) {
    const recurringEntries = await prisma.expenseEntry.findMany({
      where: { userId, templateId: existing.templateId },
    })
    deletedEntries = recurringEntries.length

    await prisma.$transaction([
      prisma.expenseEntry.deleteMany({
        where: { userId, templateId: existing.templateId },
      }),
      prisma.expenseTemplate.delete({
        where: { id: existing.templateId, userId },
      }),
    ])

    const paidByMonth = new Map<string, { month: Date; amount: Prisma.Decimal }>()
    for (const entry of recurringEntries) {
      if (entry.month < recalculateFrom) {
        recalculateFrom = entry.month
      }
      if (!entry.paid) continue

      const key = monthKeyFromDate(entry.month)
      const amount = entry.paidAmount ?? entry.amount
      const current = paidByMonth.get(key)
      paidByMonth.set(key, {
        month: entry.month,
        amount: current ? current.amount.add(amount) : amount,
      })
    }

    for (const { month, amount } of [...paidByMonth.values()].sort(
      (a, b) => a.month.getTime() - b.month.getTime()
    )) {
      await adjustActualBalance(userId, month, amount)
    }
  } else {
    const entry = await prisma.expenseEntry.delete({ where: { id, userId } })
    if (entry.paid) {
      const amount = entry.paidAmount ?? entry.amount
      await adjustActualBalance(userId, entry.month, amount)
    }
  }

  await recalcOpeningBalanceChain(userId, recalculateFrom)

  return {
    recurring: existing.templateId != null,
    deletedEntries,
  }
}
