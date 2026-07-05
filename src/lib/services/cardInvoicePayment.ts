import { getCardMonthTotal } from "@/lib/actions/cardSummary"
import { adjustActualBalance } from "@/lib/actions/monthly"
import { prisma } from "@/lib/prisma"

export async function setCardInvoicePaidForUser(
  userId: string,
  cardId: string,
  month: Date,
  paid: boolean
) {
  await prisma.card.findUniqueOrThrow({ where: { id: cardId, userId } })

  const existing = await prisma.cardInvoicePayment.findUnique({
    where: { cardId_month: { cardId, month } },
  })
  if ((existing?.paid ?? false) === paid) return

  if (paid) {
    const amount = await getCardMonthTotal(userId, cardId, month)
    await prisma.cardInvoicePayment.upsert({
      where: { cardId_month: { cardId, month } },
      update: {
        paid: true,
        paidAt: new Date(),
        paidAmount: amount,
      },
      create: {
        cardId,
        month,
        paid: true,
        paidAt: new Date(),
        paidAmount: amount,
      },
    })
    await adjustActualBalance(userId, month, amount.neg())
  } else if (existing?.paid) {
    await prisma.cardInvoicePayment.update({
      where: { id: existing.id },
      data: {
        paid: false,
        paidAt: null,
        paidAmount: null,
      },
    })
    if (existing.paidAmount) {
      await adjustActualBalance(userId, month, existing.paidAmount)
    }
  }
}
