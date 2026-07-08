import type { Prisma } from "@/generated/prisma/client"

import { addMonths } from "@/lib/calculations/month"
import { invoiceMonthForPurchase, type CardCycle } from "@/lib/calculations/cardTiming"
import { splitIntoInstallments } from "@/lib/calculations/installments"

export async function rematerializeCardPurchaseSchedules(
  tx: Prisma.TransactionClient,
  cardId: string,
  card: CardCycle
): Promise<Date[]> {
  const purchases = await tx.cardPurchase.findMany({
    where: { cardId },
    include: { installments: { orderBy: { installmentNo: "asc" } } },
  })

  const affectedMonths: Date[] = []
  for (const purchase of purchases) {
    const previousBillingMonth =
      purchase.billingMonth ??
      new Date(Date.UTC(purchase.purchaseDate.getUTCFullYear(), purchase.purchaseDate.getUTCMonth(), 1))
    const nextBillingMonth = invoiceMonthForPurchase(card, purchase.purchaseDate)
    affectedMonths.push(previousBillingMonth, nextBillingMonth)

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

  return affectedMonths
}
