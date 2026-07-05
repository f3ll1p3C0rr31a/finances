import { Prisma } from "@/generated/prisma/client"

import { prisma } from "@/lib/prisma"
import { sumAmounts } from "@/lib/calculations/money"

type SubscriptionLike = { startMonth: Date; cancelledMonth: Date | null }

/**
 * A subscription applies to a month if it had already started and
 * hadn't been cancelled before that month. Cancelling in month X still
 * counts X as billed (the cycle already committed) — only months
 * after X stop.
 */
export function isSubscriptionActiveInMonth(sub: SubscriptionLike, month: Date): boolean {
  return sub.startMonth <= month && (sub.cancelledMonth == null || month <= sub.cancelledMonth)
}

export async function getCardSubscriptionsTotal(
  userId: string,
  cardId: string,
  month: Date
): Promise<Prisma.Decimal> {
  const subs = await prisma.subscription.findMany({ where: { userId, cardId } })
  return sumAmounts(
    subs.filter((s) => isSubscriptionActiveInMonth(s, month)).map((s) => s.amount)
  )
}

export async function getNonCardSubscriptionsTotal(
  userId: string,
  month: Date
): Promise<Prisma.Decimal> {
  const subs = await getNonCardSubscriptionsForMonth(userId, month)
  return sumAmounts(subs.map((s) => s.amount))
}

export async function getNonCardSubscriptionsForMonth(userId: string, month: Date) {
  const subs = await prisma.subscription.findMany({ where: { userId, cardId: null } })
  return subs.filter((s) => isSubscriptionActiveInMonth(s, month))
}
