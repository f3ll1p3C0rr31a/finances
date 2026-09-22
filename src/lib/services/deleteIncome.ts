import { Prisma } from "@/generated/prisma/client"
import { adjustActualBalance, recalcOpeningBalanceChain } from "@/lib/actions/monthly"
import { addMonths, monthKeyFromDate } from "@/lib/calculations/month"
import { prisma } from "@/lib/prisma"
import type { RecurrenceScope } from "@/lib/validation/schemas"

export type DeleteIncomeResult = {
  recurring: boolean
  scope: RecurrenceScope
  deletedEntries: number
}

type DeletedEntry = {
  month: Date
  received: boolean
  amount: Prisma.Decimal
  receivedAmount: Prisma.Decimal | null
}

/**
 * Tira do saldo real, mês a mês, o que as entradas removidas já haviam
 * creditado, e responde qual foi o mês mais antigo afetado para que a cadeia
 * de aberturas seja recalculada a partir dele.
 */
async function compensateReceivedEntries(
  userId: string,
  entries: DeletedEntry[],
  earliestMonth: Date
): Promise<Date> {
  let recalculateFrom = earliestMonth
  const receivedByMonth = new Map<string, { month: Date; amount: Prisma.Decimal }>()

  for (const entry of entries) {
    if (entry.month < recalculateFrom) {
      recalculateFrom = entry.month
    }
    if (!entry.received) continue

    const key = monthKeyFromDate(entry.month)
    const amount = entry.receivedAmount ?? entry.amount
    const current = receivedByMonth.get(key)
    receivedByMonth.set(key, {
      month: entry.month,
      amount: current ? current.amount.add(amount) : amount,
    })
  }

  for (const { month, amount } of [...receivedByMonth.values()].sort(
    (a, b) => a.month.getTime() - b.month.getTime()
  )) {
    await adjustActualBalance(userId, month, amount.neg())
  }

  return recalculateFrom
}

export async function deleteIncomeForUser(
  userId: string,
  id: string,
  scope: RecurrenceScope
): Promise<DeleteIncomeResult> {
  const existing = await prisma.incomeEntry.findUniqueOrThrow({ where: { id, userId } })
  let recalculateFrom = existing.month
  let deletedEntries = 1

  if (!existing.templateId) {
    const entry = await prisma.incomeEntry.delete({ where: { id, userId } })
    if (entry.received) {
      const amount = entry.receivedAmount ?? entry.amount
      await adjustActualBalance(userId, entry.month, amount.neg())
    }
    await recalcOpeningBalanceChain(userId, recalculateFrom)
    return { recurring: false, scope, deletedEntries: 1 }
  }

  const templateId = existing.templateId

  if (scope === "ONLY_THIS") {
    // O mês vira exceção do template: sem isso, a materialização recriaria a
    // ocorrência no próximo carregamento do dashboard.
    await prisma.$transaction([
      prisma.incomeEntry.delete({ where: { id, userId } }),
      prisma.incomeTemplateSkip.upsert({
        where: { templateId_month: { templateId, month: existing.month } },
        update: {},
        create: { templateId, month: existing.month },
      }),
    ])

    recalculateFrom = await compensateReceivedEntries(userId, [existing], recalculateFrom)
  } else {
    const template = await prisma.incomeTemplate.findUniqueOrThrow({
      where: { id: templateId, userId },
    })
    const doomed = await prisma.incomeEntry.findMany({
      where: { userId, templateId, month: { gte: existing.month } },
    })
    deletedEntries = doomed.length

    // Encerrar no mês anterior preserva o histórico já materializado. Se a
    // exclusão alcança o próprio início da recorrência não sobra nada dela,
    // então o template vai junto.
    const keepsHistory = existing.month > template.startMonth

    await prisma.$transaction([
      prisma.incomeEntry.deleteMany({
        where: { userId, templateId, month: { gte: existing.month } },
      }),
      prisma.incomeTemplateSkip.deleteMany({
        where: { templateId, month: { gte: existing.month } },
      }),
      keepsHistory
        ? prisma.incomeTemplate.update({
            where: { id: templateId, userId },
            data: { endMonth: addMonths(existing.month, -1) },
          })
        : prisma.incomeTemplate.delete({ where: { id: templateId, userId } }),
    ])

    recalculateFrom = await compensateReceivedEntries(userId, doomed, recalculateFrom)
  }

  await recalcOpeningBalanceChain(userId, recalculateFrom)

  return { recurring: true, scope, deletedEntries }
}
