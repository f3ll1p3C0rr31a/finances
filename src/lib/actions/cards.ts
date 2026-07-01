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

export async function createCardPurchase(cardId: string, input: CardPurchaseInput) {
  const userId = await requireUserId()
  const data = cardPurchaseSchema.parse(input)

  await prisma.card.findUniqueOrThrow({ where: { id: cardId, userId } })

  const [year, month, day] = data.purchaseDate.split("-").map(Number)
  const purchaseDate = new Date(Date.UTC(year, month - 1, day))
  const purchaseMonth = new Date(Date.UTC(year, month - 1, 1))

  const purchaseId = await prisma.$transaction(async (tx) => {
    const purchase = await tx.cardPurchase.create({
      data: {
        cardId,
        description: data.description,
        totalAmount: data.totalAmount,
        purchaseDate,
        installmentCount: data.installmentCount,
      },
    })

    if (data.installmentCount > 1) {
      const slices = splitIntoInstallments(
        new Prisma.Decimal(data.totalAmount),
        data.installmentCount
      )
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
