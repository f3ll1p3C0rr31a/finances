import { Prisma } from "@/generated/prisma/client"

import { prisma } from "@/lib/prisma"
import { sumAmounts } from "@/lib/calculations/money"
import { addMonths, dateWithDay, monthKeyFromDate } from "@/lib/calculations/month"
import { chargeDateForBillingMonth, type CardCycle } from "@/lib/calculations/cardTiming"
import { subscriptionBillsOnDate } from "@/lib/services/subscriptionCharges"

export type PaymentMethod = "CASH" | "PIX" | "TRANSFER" | "BOLETO" | "CARD" | "OTHER"

/**
 * One subscription charge that lands on a given billing month — either a
 * materialized SubscriptionCharge (its date has been reached, so it keeps
 * the amount recorded at charge time) or a projection of a future charge
 * while the subscription stays active.
 */
export type SubscriptionChargeItem = {
  subscriptionId: string
  name: string
  amount: Prisma.Decimal
  chargeDate: Date
  materialized: boolean
  paymentMethod: PaymentMethod
  logoDomain: string | null
  cancelled: boolean
  tags: { id: string; name: string }[]
}

function monthOf(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

/**
 * Charges of the user's subscriptions that land on the invoice/month
 * `billingMonth`. `card` must be the card's cycle when `cardId` is given
 * (the charge date is mapped through the invoice cycle); for cardId null
 * the charge simply belongs to its own calendar month.
 *
 * Materialized charges win over projections for the same calendar month,
 * even if a cycle edit moved where the projection would land, so a charge
 * is never counted twice across billing months.
 */
async function chargeItemsForBillingMonth(
  userId: string,
  billingMonth: Date,
  cardId: string | null,
  card: CardCycle | null
): Promise<SubscriptionChargeItem[]> {
  const subscriptionWhere = { userId, cardId }
  const [subscriptions, charges] = await Promise.all([
    prisma.subscription.findMany({
      where: subscriptionWhere,
      include: { tags: { include: { tag: true } } },
    }),
    prisma.subscriptionCharge.findMany({
      where: {
        subscription: subscriptionWhere,
        OR: [
          { billingMonth },
          { month: { gte: addMonths(billingMonth, -2), lte: billingMonth } },
        ],
      },
    }),
  ])

  const subscriptionsById = new Map(subscriptions.map((sub) => [sub.id, sub]))
  const coveredCalendarMonths = new Set(
    charges.map((charge) => `${charge.subscriptionId}:${monthKeyFromDate(charge.month)}`)
  )

  const items: SubscriptionChargeItem[] = []

  for (const charge of charges) {
    if (charge.billingMonth.getTime() !== billingMonth.getTime()) continue
    const sub = subscriptionsById.get(charge.subscriptionId)
    if (!sub) continue
    items.push({
      subscriptionId: sub.id,
      name: sub.name,
      amount: charge.amount,
      chargeDate: charge.chargeDate,
      materialized: true,
      paymentMethod: sub.paymentMethod as PaymentMethod,
      logoDomain: sub.logoDomain,
      cancelled: sub.cancelledAt != null,
      tags: sub.tags.map((t) => ({ id: t.tag.id, name: t.tag.name })),
    })
  }

  for (const sub of subscriptions) {
    const chargeDate = cardId
      ? chargeDateForBillingMonth(card ?? { closingDay: null, paymentDay: null }, sub.chargeDay, billingMonth)
      : dateWithDay(billingMonth, sub.chargeDay)
    if (!chargeDate) continue
    if (coveredCalendarMonths.has(`${sub.id}:${monthKeyFromDate(monthOf(chargeDate))}`)) continue
    if (!subscriptionBillsOnDate(sub, chargeDate)) continue
    items.push({
      subscriptionId: sub.id,
      name: sub.name,
      amount: sub.amount,
      chargeDate,
      materialized: false,
      paymentMethod: sub.paymentMethod as PaymentMethod,
      logoDomain: sub.logoDomain,
      cancelled: sub.cancelledAt != null,
      tags: sub.tags.map((t) => ({ id: t.tag.id, name: t.tag.name })),
    })
  }

  return items
}

export async function getCardSubscriptionChargesForMonth(
  userId: string,
  cardId: string,
  month: Date,
  card?: CardCycle
): Promise<SubscriptionChargeItem[]> {
  const cycle =
    card ??
    (await prisma.card.findUniqueOrThrow({
      where: { id: cardId },
      select: { closingDay: true, paymentDay: true },
    }))
  return chargeItemsForBillingMonth(userId, month, cardId, cycle)
}

export async function getCardSubscriptionsTotal(
  userId: string,
  cardId: string,
  month: Date,
  card?: CardCycle
): Promise<Prisma.Decimal> {
  const items = await getCardSubscriptionChargesForMonth(userId, cardId, month, card)
  return sumAmounts(items.map((item) => item.amount))
}

export async function getNonCardSubscriptionsForMonth(
  userId: string,
  month: Date
): Promise<SubscriptionChargeItem[]> {
  return chargeItemsForBillingMonth(userId, month, null, null)
}

export async function getNonCardSubscriptionsTotal(
  userId: string,
  month: Date
): Promise<Prisma.Decimal> {
  const items = await getNonCardSubscriptionsForMonth(userId, month)
  return sumAmounts(items.map((item) => item.amount))
}
