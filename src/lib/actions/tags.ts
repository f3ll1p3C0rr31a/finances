"use server"

import { revalidatePath } from "next/cache"

import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"
import { propagateExpenseTags, propagateIncomeTags } from "@/lib/services/recurringEntries"

export async function listTags(userId: string) {
  return prisma.tag.findMany({ where: { userId }, orderBy: { name: "asc" } })
}

export async function createTag(name: string) {
  const userId = await requireUserId()
  const trimmed = name.trim()
  if (!trimmed) throw new Error("Nome inválido")

  const tag = await prisma.tag.upsert({
    where: { userId_name: { userId, name: trimmed } },
    update: {},
    create: { userId, name: trimmed },
  })

  revalidatePath("/dashboard", "layout")
  revalidatePath("/cards", "layout")
  revalidatePath("/assinaturas")
  return { id: tag.id, name: tag.name }
}

export async function deleteTag(id: string) {
  const userId = await requireUserId()
  await prisma.tag.delete({ where: { id, userId } })
  revalidatePath("/dashboard", "layout")
  revalidatePath("/cards", "layout")
  revalidatePath("/assinaturas")
}

export async function setCardPurchaseTags(purchaseId: string, tagIds: string[]) {
  const userId = await requireUserId()
  const purchase = await prisma.cardPurchase.findUniqueOrThrow({
    where: { id: purchaseId },
    include: { card: true },
  })
  if (purchase.card.userId !== userId) throw new Error("Unauthorized")

  await prisma.$transaction([
    prisma.cardPurchaseTag.deleteMany({ where: { purchaseId } }),
    prisma.cardPurchaseTag.createMany({
      data: tagIds.map((tagId) => ({ purchaseId, tagId })),
    }),
  ])
  revalidatePath("/cards", "layout")
}

export async function bulkSetCardPurchaseTags(purchaseIds: string[], tagIds: string[]) {
  const userId = await requireUserId()
  const purchases = await prisma.cardPurchase.findMany({
    where: { id: { in: purchaseIds } },
    include: { card: true },
  })
  if (purchases.some((p) => p.card.userId !== userId)) throw new Error("Unauthorized")

  await prisma.$transaction([
    prisma.cardPurchaseTag.deleteMany({ where: { purchaseId: { in: purchaseIds } } }),
    prisma.cardPurchaseTag.createMany({
      data: purchaseIds.flatMap((purchaseId) => tagIds.map((tagId) => ({ purchaseId, tagId }))),
    }),
  ])
  revalidatePath("/cards", "layout")
}

export async function setIncomeEntryTags(entryId: string, tagIds: string[]) {
  const userId = await requireUserId()
  const entry = await prisma.incomeEntry.findUniqueOrThrow({ where: { id: entryId, userId } })

  await prisma.$transaction([
    prisma.incomeEntryTag.deleteMany({ where: { entryId } }),
    prisma.incomeEntryTag.createMany({ data: tagIds.map((tagId) => ({ entryId, tagId })) }),
  ])
  await propagateIncomeTags(userId, entry, tagIds)
  revalidatePath("/dashboard", "layout")
}

export async function setExpenseEntryTags(entryId: string, tagIds: string[]) {
  const userId = await requireUserId()
  const entry = await prisma.expenseEntry.findUniqueOrThrow({ where: { id: entryId, userId } })

  await prisma.$transaction([
    prisma.expenseEntryTag.deleteMany({ where: { entryId } }),
    prisma.expenseEntryTag.createMany({ data: tagIds.map((tagId) => ({ entryId, tagId })) }),
  ])
  await propagateExpenseTags(userId, entry, tagIds)
  revalidatePath("/dashboard", "layout")
}

export async function setSubscriptionTags(subscriptionId: string, tagIds: string[]) {
  const userId = await requireUserId()
  await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId, userId } })

  await prisma.$transaction([
    prisma.subscriptionTag.deleteMany({ where: { subscriptionId } }),
    prisma.subscriptionTag.createMany({
      data: tagIds.map((tagId) => ({ subscriptionId, tagId })),
    }),
  ])
  revalidatePath("/assinaturas")
  revalidatePath("/dashboard", "layout")
  revalidatePath("/cards", "layout")
}
