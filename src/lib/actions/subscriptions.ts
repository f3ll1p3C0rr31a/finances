"use server"

import { revalidatePath } from "next/cache"

import { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"
import { currentMonth } from "@/lib/calculations/month"
import {
  subscriptionSchema,
  type SubscriptionInput,
} from "@/lib/validation/subscriptionSchemas"

function revalidateSubscriptions() {
  revalidatePath("/assinaturas")
  revalidatePath("/dashboard", "layout")
  revalidatePath("/cards", "layout")
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
      startMonth: currentMonth(),
    },
  })
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
    },
  })
  revalidateSubscriptions()
}

export async function cancelSubscription(id: string) {
  const userId = await requireUserId()
  await prisma.subscription.update({
    where: { id, userId },
    data: { active: false, cancelledMonth: currentMonth() },
  })
  revalidateSubscriptions()
}

export async function reactivateSubscription(id: string) {
  const userId = await requireUserId()
  await prisma.subscription.update({
    where: { id, userId },
    data: { active: true, cancelledMonth: null },
  })
  revalidateSubscriptions()
}

export async function deleteSubscription(id: string) {
  const userId = await requireUserId()
  await prisma.subscription.delete({ where: { id, userId } })
  revalidateSubscriptions()
}
