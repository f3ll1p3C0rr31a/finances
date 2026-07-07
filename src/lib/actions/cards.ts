"use server"

import { revalidatePath } from "next/cache"

import { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"
import { addMonths } from "@/lib/calculations/month"
import { invoiceMonthForPurchase } from "@/lib/calculations/cardTiming"
import { splitIntoInstallments } from "@/lib/calculations/installments"
import { recalcOpeningBalanceChain } from "@/lib/actions/monthly"
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
      },
    })

    const purchases = await tx.cardPurchase.findMany({
      where: { cardId: id },
      include: { installments: { orderBy: { installmentNo: "asc" } } },
    })

    const changedMonths: Date[] = []
    for (const purchase of purchases) {
      const previousBillingMonth = purchase.billingMonth ?? monthFromDate(purchase.purchaseDate)
      const nextBillingMonth = invoiceMonthForPurchase(card, purchase.purchaseDate)
      changedMonths.push(previousBillingMonth, nextBillingMonth)

      const fallbackSlices = splitIntoInstallments(purchase.totalAmount, purchase.installmentCount)
      const slices =
        purchase.installments.length === purchase.installmentCount
          ? purchase.installments.map((installment) => installment.amount)
          : fallbackSlices

      await tx.cardPurchase.update({
        where: { id: purchase.id },
        data: { billingMonth: nextBillingMonth },
      })

      if (purchase.installmentCount > 1) {
        await tx.cardInstallment.deleteMany({ where: { purchaseId: purchase.id } })
        await tx.cardInstallment.createMany({
          data: slices.map((amount, index) => ({
            purchaseId: purchase.id,
            installmentNo: index + 1,
            month: addMonths(nextBillingMonth, index),
            amount,
          })),
        })
      }
    }

    return changedMonths
  })
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

async function recalcCardAffectedChain(userId: string, earliestAffectedMonth: Date) {
  await recalcOpeningBalanceChain(userId, addMonths(earliestAffectedMonth, -1))
  await recalcOpeningBalanceChain(userId, earliestAffectedMonth)
}

function monthFromDate(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

export async function createCardPurchase(cardId: string, input: CardPurchaseInput) {
  const userId = await requireUserId()
  const data = cardPurchaseSchema.parse(input)

  const card = await prisma.card.findUniqueOrThrow({ where: { id: cardId, userId } })

  const [year, month, day] = data.purchaseDate.split("-").map(Number)
  const purchaseDate = new Date(Date.UTC(year, month - 1, day))
  const purchaseMonth = monthFromDate(purchaseDate)
  const billingMonth = invoiceMonthForPurchase(card, purchaseDate)

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
        billingMonth,
        installmentCount: data.installmentCount,
        hasInterest: data.hasInterest,
      },
    })

    if (data.installmentCount > 1) {
      await tx.cardInstallment.createMany({
        data: slices.map((amount, index) => ({
          purchaseId: purchase.id,
          installmentNo: index + 1,
          month: addMonths(billingMonth, index),
          amount,
        })),
      })
    }

    return purchase.id
  })

  revalidateCards()
  await recalcCardAffectedChain(userId, purchaseMonth < billingMonth ? purchaseMonth : billingMonth)
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
