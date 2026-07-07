import { prisma } from "@/lib/prisma"
import { addMonths } from "@/lib/calculations/month"
import { isSubscriptionActiveInMonth } from "@/lib/actions/subscriptionSummary"

export type SpendingRow = {
  tagName: string
  paymentMethod: "CASH" | "PIX" | "TRANSFER" | "BOLETO" | "CARD" | "OTHER"
  amount: number
}

const NO_TAG = "Sem etiqueta"

/**
 * Raw (tag, payment method) -> amount rows for the month, meant to be
 * grouped/filtered client-side so the payment-method filter doesn't
 * need a server round trip. Card purchases/installments always count
 * as payment method CARD; an entry/purchase with multiple tags
 * contributes its full amount to each tag (so totals can add up to
 * more than the month's spend when items are multi-tagged — this
 * favors "how much went to X" over a strict partition).
 */
export async function getSpendingByTagRows(userId: string, month: Date): Promise<SpendingRow[]> {
  const nextMonth = addMonths(month, 1)
  const rows: SpendingRow[] = []

  const expenses = await prisma.expenseEntry.findMany({
    where: { userId, month },
    include: { tags: { include: { tag: true } } },
  })
  for (const entry of expenses) {
    const amount = entry.amount.toNumber()
    const names = entry.tags.length > 0 ? entry.tags.map((t) => t.tag.name) : [NO_TAG]
    for (const tagName of names) {
      rows.push({ tagName, paymentMethod: entry.paymentMethod, amount })
    }
  }

  const [installments, singlePurchases, subscriptions] = await Promise.all([
    prisma.cardInstallment.findMany({
      where: { month, purchase: { card: { userId } } },
      include: { purchase: { include: { tags: { include: { tag: true } } } } },
    }),
    prisma.cardPurchase.findMany({
      where: {
        installmentCount: 1,
        OR: [
          { billingMonth: month },
          { billingMonth: null, purchaseDate: { gte: month, lt: nextMonth } },
        ],
        card: { userId },
      },
      include: { tags: { include: { tag: true } } },
    }),
    prisma.subscription.findMany({
      where: { userId },
      include: { tags: { include: { tag: true } } },
    }),
  ])

  for (const installment of installments) {
    const amount = installment.amount.toNumber()
    const tags = installment.purchase.tags
    const names = tags.length > 0 ? tags.map((t) => t.tag.name) : [NO_TAG]
    for (const tagName of names) {
      rows.push({ tagName, paymentMethod: "CARD", amount })
    }
  }

  for (const purchase of singlePurchases) {
    const amount = purchase.totalAmount.toNumber()
    const names = purchase.tags.length > 0 ? purchase.tags.map((t) => t.tag.name) : [NO_TAG]
    for (const tagName of names) {
      rows.push({ tagName, paymentMethod: "CARD", amount })
    }
  }

  for (const subscription of subscriptions.filter((sub) => isSubscriptionActiveInMonth(sub, month))) {
    const amount = subscription.amount.toNumber()
    const names =
      subscription.tags.length > 0 ? subscription.tags.map((t) => t.tag.name) : [NO_TAG]
    const paymentMethod = subscription.cardId ? "CARD" : subscription.paymentMethod
    for (const tagName of names) {
      rows.push({ tagName, paymentMethod, amount })
    }
  }

  return rows
}
