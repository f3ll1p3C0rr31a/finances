"use server"

import { revalidatePath } from "next/cache"

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

export async function listSubscriptions(userId: string) {
  return prisma.subscription.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    include: { card: true },
  })
}

export async function createSubscription(input: SubscriptionInput) {
  const userId = await requireUserId()
  const data = subscriptionSchema.parse(input)

  await prisma.subscription.create({
    data: {
      userId,
      name: data.name,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      cardId: data.paymentMethod === "CARD" ? data.cardId ?? null : null,
      startMonth: currentMonth(),
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
