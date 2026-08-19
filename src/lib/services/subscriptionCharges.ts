import type { Prisma } from "@/generated/prisma/client"

import { prisma } from "@/lib/prisma"
import { addMonths, dateWithDay, today } from "@/lib/calculations/month"
import { invoiceMonthForPurchase } from "@/lib/calculations/cardTiming"

/** Hoje no fuso do app (ver `today()`), normalizado em UTC. */
export function utcToday(): Date {
  return today()
}

function monthOf(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

type ChargeableSubscription = {
  id: string
  chargeDay: number
  startMonth: Date
  cancelledAt: Date | null
  cardId: string | null
  card: { closingDay: number | null; paymentDay: number | null } | null
  amount: Prisma.Decimal
}

/**
 * The window in which a subscription actually bills: from its first
 * charge (chargeDay of startMonth) until cancelledAt, inclusive. A
 * charge due exactly on the cancellation day still bills — cancelling
 * only stops charges after that date.
 */
export function subscriptionBillsOnDate(
  sub: { chargeDay: number; startMonth: Date; cancelledAt: Date | null },
  chargeDate: Date
): boolean {
  const firstCharge = dateWithDay(sub.startMonth, sub.chargeDay)
  if (chargeDate < firstCharge) return false
  return sub.cancelledAt == null || chargeDate <= sub.cancelledAt
}

async function ensureChargesForSubscription(sub: ChargeableSubscription, today: Date) {
  const lastCharge = await prisma.subscriptionCharge.findFirst({
    where: { subscriptionId: sub.id },
    orderBy: { month: "desc" },
    select: { month: true },
  })

  const startMonth = monthOf(sub.startMonth)
  let cursor = lastCharge ? addMonths(lastCharge.month, 1) : startMonth
  if (cursor < startMonth) cursor = startMonth

  const horizon = monthOf(today)
  while (cursor <= horizon) {
    const chargeDate = dateWithDay(cursor, sub.chargeDay)
    if (chargeDate <= today && subscriptionBillsOnDate(sub, chargeDate)) {
      const billingMonth = sub.card
        ? invoiceMonthForPurchase(sub.card, chargeDate)
        : cursor
      await prisma.subscriptionCharge.upsert({
        where: { subscriptionId_month: { subscriptionId: sub.id, month: cursor } },
        update: {},
        create: {
          subscriptionId: sub.id,
          chargeDate,
          month: cursor,
          billingMonth,
          amount: sub.amount,
        },
      })
    }
    cursor = addMonths(cursor, 1)
  }
}

/**
 * Materializes every subscription charge whose charge date has been
 * reached, walking month by month from the last materialized charge (or
 * startMonth). Cancelled subscriptions are included so a charge due
 * before the cancellation date is never lost. Idempotent: existing
 * charges are never overwritten, keeping their historical amount even
 * after price/rate edits.
 */
export async function ensureSubscriptionChargesGenerated(userId: string): Promise<void> {
  const today = utcToday()
  const subscriptions = await prisma.subscription.findMany({
    where: { userId },
    include: { card: { select: { closingDay: true, paymentDay: true } } },
  })

  for (const sub of subscriptions) {
    await ensureChargesForSubscription(sub, today)
  }
}

/**
 * Drops charges from the current calendar month onward and regenerates
 * them. Used when the user edits chargeDay/card/amount so the correction
 * applies to the month in progress, while months already past keep their
 * recorded history.
 */
export async function rematerializeUpcomingSubscriptionCharges(
  subscriptionId: string
): Promise<void> {
  const today = utcToday()
  await prisma.subscriptionCharge.deleteMany({
    where: { subscriptionId, month: { gte: monthOf(today) } },
  })
  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { card: { select: { closingDay: true, paymentDay: true } } },
  })
  if (sub) await ensureChargesForSubscription(sub, today)
}
