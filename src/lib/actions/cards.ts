"use server"

import { revalidatePath } from "next/cache"

import { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"
import { addMonths } from "@/lib/calculations/month"
import { splitIntoInstallments } from "@/lib/calculations/installments"
import {
  cardSchema,
  cardPurchaseSchema,
  cardGoalSchema,
  type CardInput,
  type CardPurchaseInput,
  type CardGoalInput,
} from "@/lib/validation/cardSchemas"

function revalidateCards() {
  revalidatePath("/cards")
  revalidatePath("/dashboard", "layout")
}

export async function createCard(input: CardInput) {
  const userId = await requireUserId()
  const data = cardSchema.parse(input)
  await prisma.card.create({
    data: { userId, name: data.name, closingDay: data.closingDay ?? null },
  })
  revalidateCards()
}

export async function updateCard(id: string, input: CardInput) {
  const userId = await requireUserId()
  const data = cardSchema.parse(input)
  await prisma.card.update({
    where: { id, userId },
    data: { name: data.name, closingDay: data.closingDay ?? null },
  })
  revalidateCards()
  revalidatePath(`/cards/${id}`)
}

export async function deleteCard(id: string) {
  const userId = await requireUserId()
  await prisma.card.delete({ where: { id, userId } })
  revalidateCards()
}

/**
 * Resolves the (totalAmount, perInstallmentSlices) pair for a purchase
 * depending on whether the user typed the purchase's total or a single
 * installment's value. In INSTALLMENT mode every slice is exactly the
 * typed amount (no rounding split needed); in TOTAL mode the total is
 * divided across installments with the remainder cent on the last one.
 */
function resolvePurchaseAmounts(
  amount: number,
  amountMode: "TOTAL" | "INSTALLMENT",
  installmentCount: number
): { totalAmount: Prisma.Decimal; slices: Prisma.Decimal[] } {
  if (amountMode === "INSTALLMENT") {
    const perInstallment = new Prisma.Decimal(amount)
    return {
      totalAmount: perInstallment.mul(installmentCount),
      slices: Array.from({ length: installmentCount }, () => perInstallment),
    }
  }
  const totalAmount = new Prisma.Decimal(amount)
  return {
    totalAmount,
    slices: installmentCount > 1 ? splitIntoInstallments(totalAmount, installmentCount) : [totalAmount],
  }
}

export async function createCardPurchase(cardId: string, input: CardPurchaseInput) {
  const userId = await requireUserId()
  const data = cardPurchaseSchema.parse(input)

  await prisma.card.findUniqueOrThrow({ where: { id: cardId, userId } })

  const [year, month, day] = data.purchaseDate.split("-").map(Number)
  const purchaseDate = new Date(Date.UTC(year, month - 1, day))
  const purchaseMonth = new Date(Date.UTC(year, month - 1, 1))

  const { totalAmount, slices } = resolvePurchaseAmounts(
    data.amount,
    data.amountMode,
    data.installmentCount
  )

  const purchaseId = await prisma.$transaction(async (tx) => {
    const purchase = await tx.cardPurchase.create({
      data: {
        cardId,
        description: data.description,
        totalAmount,
        purchaseDate,
        installmentCount: data.installmentCount,
        hasInterest: data.hasInterest,
      },
    })

    if (data.installmentCount > 1) {
      await tx.cardInstallment.createMany({
        data: slices.map((amount, index) => ({
          purchaseId: purchase.id,
          installmentNo: index + 1,
          month: addMonths(purchaseMonth, index),
          amount,
        })),
      })
    }

    return purchase.id
  })

  revalidateCards()
  revalidatePath(`/cards/${cardId}`)
  return { id: purchaseId }
}

export async function updateCardPurchase(purchaseId: string, input: CardPurchaseInput) {
  const userId = await requireUserId()
  const data = cardPurchaseSchema.parse(input)

  const existing = await prisma.cardPurchase.findUniqueOrThrow({
    where: { id: purchaseId },
    include: { card: true },
  })
  if (existing.card.userId !== userId) throw new Error("Unauthorized")

  const [year, month, day] = data.purchaseDate.split("-").map(Number)
  const purchaseDate = new Date(Date.UTC(year, month - 1, day))
  const purchaseMonth = new Date(Date.UTC(year, month - 1, 1))

  const { totalAmount, slices } = resolvePurchaseAmounts(
    data.amount,
    data.amountMode,
    data.installmentCount
  )

  await prisma.$transaction(async (tx) => {
    await tx.cardPurchase.update({
      where: { id: purchaseId },
      data: {
        description: data.description,
        totalAmount,
        purchaseDate,
        installmentCount: data.installmentCount,
        hasInterest: data.hasInterest,
      },
    })

    await tx.cardInstallment.deleteMany({ where: { purchaseId } })

    if (data.installmentCount > 1) {
      await tx.cardInstallment.createMany({
        data: slices.map((amount, index) => ({
          purchaseId,
          installmentNo: index + 1,
          month: addMonths(purchaseMonth, index),
          amount,
        })),
      })
    }
  })

  revalidateCards()
  revalidatePath(`/cards/${existing.cardId}`)
}

export async function deleteCardPurchase(purchaseId: string) {
  const userId = await requireUserId()
  const purchase = await prisma.cardPurchase.findUniqueOrThrow({
    where: { id: purchaseId },
    include: { card: true },
  })
  if (purchase.card.userId !== userId) {
    throw new Error("Unauthorized")
  }
  await prisma.cardPurchase.delete({ where: { id: purchaseId } })
  revalidateCards()
  revalidatePath(`/cards/${purchase.cardId}`)
}

export async function setCardGoal(month: Date, input: CardGoalInput) {
  const userId = await requireUserId()
  const data = cardGoalSchema.parse(input)

  await prisma.cardSpendingGoal.upsert({
    where: { userId_month: { userId, month } },
    update: { amount: data.amount },
    create: { userId, month, amount: data.amount },
  })

  revalidateCards()
}
