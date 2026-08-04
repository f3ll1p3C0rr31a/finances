import { prisma } from "@/lib/prisma"

/**
 * Ids (of ExpenseEntry / IncomeEntry / CardPurchase) that were created by a
 * Pluggy import, so the UI can mark them as automatic. Looked up in one query
 * per page render instead of joining on three unrelated models.
 */
export async function findImportedTargetIds(targetIds: string[]): Promise<Set<string>> {
  if (targetIds.length === 0) return new Set()

  const rows = await prisma.pluggyImportedTransaction.findMany({
    where: { targetId: { in: targetIds } },
    select: { targetId: true },
  })

  return new Set(rows.flatMap((row) => (row.targetId ? [row.targetId] : [])))
}
