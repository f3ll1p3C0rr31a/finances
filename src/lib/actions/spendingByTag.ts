import { prisma } from "@/lib/prisma"
import { getCardsMonthSummary } from "@/lib/actions/cardSummary"
import { getNonCardSubscriptionsForMonth } from "@/lib/actions/subscriptionSummary"

export type SpendingRow = {
  tagName: string
  paymentMethod: "CASH" | "PIX" | "TRANSFER" | "BOLETO" | "CARD" | "OTHER"
  amount: number
}

const CARD_INVOICE_TAG = "Fatura do Cartão"

/**
 * Raw (tag, payment method) -> amount rows for the month, meant to be
 * grouped/filtered client-side so the payment-method filter doesn't
 * need a server round trip. Untagged manual expenses and subscriptions
 * are ignored because this chart is explicitly "by tag". Card spending
 * mirrors the dashboard's invoice row and is always grouped under
 * "Fatura do Cartão".
 */
export async function getSpendingByTagRows(userId: string, month: Date): Promise<SpendingRow[]> {
  const rows: SpendingRow[] = []

  const [expenses, subscriptionCharges, cardSummary] = await Promise.all([
    prisma.expenseEntry.findMany({
      where: { userId, month, uncertain: false },
      include: { tags: { include: { tag: true } } },
    }),
    getNonCardSubscriptionsForMonth(userId, month),
    getCardsMonthSummary(userId, month),
  ])

  for (const entry of expenses) {
    if (entry.tags.length === 0) continue
    const amount = entry.amount.toNumber()
    for (const tagName of entry.tags.map((t) => t.tag.name)) {
      rows.push({ tagName, paymentMethod: entry.paymentMethod, amount })
    }
  }

  for (const summary of cardSummary.summaries) {
    const amount = summary.total.toNumber()
    if (amount <= 0) continue
    rows.push({ tagName: CARD_INVOICE_TAG, paymentMethod: "CARD", amount })
  }

  for (const charge of subscriptionCharges) {
    if (charge.tags.length === 0) continue
    const amount = charge.amount.toNumber()
    for (const tagName of charge.tags.map((tag) => tag.name)) {
      rows.push({ tagName, paymentMethod: charge.paymentMethod, amount })
    }
  }

  return rows
}
