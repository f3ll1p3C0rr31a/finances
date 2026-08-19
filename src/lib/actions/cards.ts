"use server"

import { revalidatePath } from "next/cache"

import { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"
import { addMonths } from "@/lib/calculations/month"
import { invoiceMonthForPurchase } from "@/lib/calculations/cardTiming"
import { recalcOpeningBalanceChain } from "@/lib/actions/monthly"
import {
  createCardPurchaseForUser,
  monthFromDate,
  recalcCardAffectedChain,
  resolvePurchaseAmounts,
} from "@/lib/services/cardPurchase"
import { rematerializeCardPurchaseSchedules } from "@/lib/services/cardSchedule"
import { rematerializeUpcomingSubscriptionCharges } from "@/lib/services/subscriptionCharges"
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
  if (data.accountId) {
    await prisma.account.findUniqueOrThrow({ where: { id: data.accountId, userId } })
  }
  await prisma.card.create({
    data: {
      userId,
      accountId: data.accountId,
      name: data.name,
      closingDay: data.closingDay ?? null,
      bestPurchaseDay: data.bestPurchaseDay ?? null,
      paymentDay: data.paymentDay ?? null,
      creditLimit: data.creditLimit != null ? new Prisma.Decimal(data.creditLimit) : null,
      cardNumber: data.cardNumber,
      cvv: data.cvv,
      expiryMonth: data.expiryMonth,
      expiryYear: data.expiryYear,
    },
  })
  revalidateCards()
}

export async function updateCard(id: string, input: CardInput) {
  const userId = await requireUserId()
  const data = cardSchema.parse(input)
  if (data.accountId) {
    await prisma.account.findUniqueOrThrow({ where: { id: data.accountId, userId } })
  }
  const affectedMonths = await prisma.$transaction(async (tx) => {
    const card = await tx.card.update({
      where: { id, userId },
      data: {
        name: data.name,
        accountId: data.accountId,
        closingDay: data.closingDay ?? null,
        bestPurchaseDay: data.bestPurchaseDay ?? null,
        paymentDay: data.paymentDay ?? null,
        creditLimit: data.creditLimit != null ? new Prisma.Decimal(data.creditLimit) : null,
        cardNumber: data.cardNumber,
        cvv: data.cvv,
        expiryMonth: data.expiryMonth,
        expiryYear: data.expiryYear,
      },
    })

    return rematerializeCardPurchaseSchedules(tx, id, card)
  })
  // A cycle change also moves where upcoming subscription charges land.
  const cardSubscriptions = await prisma.subscription.findMany({
    where: { userId, cardId: id },
    select: { id: true },
  })
  for (const subscription of cardSubscriptions) {
    await rematerializeUpcomingSubscriptionCharges(subscription.id)
  }
  revalidateCards()
  if (affectedMonths.length > 0) {
    const earliestAffectedMonth = affectedMonths.reduce((min, month) => (month < min ? month : min))
    await recalcCardAffectedChain(userId, earliestAffectedMonth)
  }
  revalidatePath(`/cards/${id}`)
}

export async function deleteCard(id: string) {
  const userId = await requireUserId()
  await prisma.card.delete({ where: { id, userId } })
  revalidateCards()
}

export async function createCardPurchase(cardId: string, input: CardPurchaseInput) {
  const userId = await requireUserId()
  const purchase = await createCardPurchaseForUser(userId, cardId, input)

  revalidateCards()
  revalidatePath(`/cards/${cardId}`)
  return { id: purchase.id }
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
  const billingMonth = invoiceMonthForPurchase(existing.card, purchaseDate)
  const existingMonth = existing.billingMonth ?? monthFromDate(existing.purchaseDate)
  const earliestAffectedMonth = existingMonth < billingMonth ? existingMonth : billingMonth

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
        billingMonth,
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
          month: addMonths(billingMonth, index),
          amount,
        })),
      })
    }
  })

  revalidateCards()
  await recalcCardAffectedChain(userId, earliestAffectedMonth)
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
  const purchaseMonth = purchase.billingMonth ?? monthFromDate(purchase.purchaseDate)
  await prisma.cardPurchase.delete({ where: { id: purchaseId } })
  await recalcCardAffectedChain(userId, purchaseMonth)
  revalidateCards()
  revalidatePath(`/cards/${purchase.cardId}`)
}

export async function setCardGoal(month: Date, input: CardGoalInput) {
  const userId = await requireUserId()
  const data = cardGoalSchema.parse(input)
  const amount = new Prisma.Decimal(data.amount)

  await prisma.$transaction(async (tx) => {
    await tx.cardSpendingGoal.upsert({
      where: { userId_month: { userId, month } },
      update: { amount },
      create: { userId, month, amount },
    })
    await tx.cardSpendingGoal.deleteMany({
      where: { userId, month: { gt: month } },
    })
  })

  await recalcOpeningBalanceChain(userId, month)
  revalidateCards()
}
