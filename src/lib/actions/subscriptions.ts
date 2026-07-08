"use server"

import { revalidatePath } from "next/cache"

import { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"
import { addMonths, currentMonth } from "@/lib/calculations/month"
import { recalcOpeningBalanceChain } from "@/lib/actions/monthly"
import {
  ensureSubscriptionChargesGenerated,
  rematerializeUpcomingSubscriptionCharges,
  utcToday,
} from "@/lib/services/subscriptionCharges"
import {
  subscriptionSchema,
  type SubscriptionInput,
} from "@/lib/validation/subscriptionSchemas"

function revalidateSubscriptions() {
  revalidatePath("/assinaturas")
  revalidatePath("/dashboard", "layout")
  revalidatePath("/cards", "layout")
}

async function recalcSubscriptionAffectedChain(userId: string) {
  await recalcOpeningBalanceChain(userId, addMonths(currentMonth(), -1))
  await recalcOpeningBalanceChain(userId, currentMonth())
}

function resolveSubscriptionAmounts(data: SubscriptionInput) {
  const originalAmount = new Prisma.Decimal(data.amount)
  if (data.currency === "USD") {
    const exchangeRate = new Prisma.Decimal(data.exchangeRate ?? 0)
    return {
      amount: originalAmount.mul(exchangeRate).toDecimalPlaces(2),
      originalAmount,
      exchangeRate,
    }
  }

  return {
    amount: originalAmount,
    originalAmount: null,
    exchangeRate: null,
  }
}

export async function listSubscriptions(userId: string) {
  return prisma.subscription.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    include: { card: true, tags: { include: { tag: true } } },
  })
}

export async function createSubscription(input: SubscriptionInput) {
  const userId = await requireUserId()
  const data = subscriptionSchema.parse(input)
  const amounts = resolveSubscriptionAmounts(data)

  const subscription = await prisma.subscription.create({
    data: {
      userId,
      name: data.name,
      amount: amounts.amount,
      currency: data.currency,
      originalAmount: amounts.originalAmount,
      exchangeRate: amounts.exchangeRate,
      paymentMethod: data.paymentMethod,
      cardId: data.paymentMethod === "CARD" ? data.cardId ?? null : null,
      chargeDay: data.chargeDay,
      logoDomain: data.logoDomain,
      startMonth: currentMonth(),
    },
  })
  await ensureSubscriptionChargesGenerated(userId)
  await recalcSubscriptionAffectedChain(userId)
  revalidateSubscriptions()
  return { id: subscription.id }
}

export async function updateSubscription(id: string, input: SubscriptionInput) {
  const userId = await requireUserId()
  const data = subscriptionSchema.parse(input)
  const amounts = resolveSubscriptionAmounts(data)

  await prisma.subscription.update({
    where: { id, userId },
    data: {
      name: data.name,
      amount: amounts.amount,
      currency: data.currency,
      originalAmount: amounts.originalAmount,
      exchangeRate: amounts.exchangeRate,
      paymentMethod: data.paymentMethod,
      cardId: data.paymentMethod === "CARD" ? data.cardId ?? null : null,
      chargeDay: data.chargeDay,
      logoDomain: data.logoDomain,
    },
  })
  // Corrections to day/card/amount apply from the current month onward;
  // months already past keep the charges recorded at the time.
  await rematerializeUpcomingSubscriptionCharges(id)
  await recalcSubscriptionAffectedChain(userId)
  revalidateSubscriptions()
}

export async function cancelSubscription(id: string) {
  const userId = await requireUserId()
  // Materialize anything already due before cutting off, so the charge
  // of the current cycle (e.g. billed earlier today) is kept.
  await ensureSubscriptionChargesGenerated(userId)
  await prisma.subscription.update({
    where: { id, userId },
    data: { active: false, cancelledAt: utcToday() },
  })
  await recalcSubscriptionAffectedChain(userId)
  revalidateSubscriptions()
}

export async function reactivateSubscription(id: string) {
  const userId = await requireUserId()
  const subscription = await prisma.subscription.findUniqueOrThrow({ where: { id, userId } })
  // startMonth moves forward so the cancelled gap is never billed
  // retroactively; past charges stay materialized. If this month's charge
  // day has already passed, billing resumes only next month.
  const resumeMonth =
    utcToday().getUTCDate() > subscription.chargeDay
      ? addMonths(currentMonth(), 1)
      : currentMonth()
  await prisma.subscription.update({
    where: { id, userId },
    data: { active: true, cancelledAt: null, startMonth: resumeMonth },
  })
  await recalcSubscriptionAffectedChain(userId)
  revalidateSubscriptions()
}

export async function deleteSubscription(id: string) {
  const userId = await requireUserId()
  await prisma.subscription.delete({ where: { id, userId } })
  await recalcSubscriptionAffectedChain(userId)
  revalidateSubscriptions()
}
