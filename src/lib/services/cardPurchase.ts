import { Prisma } from "@/generated/prisma/client"

import { prisma } from "@/lib/prisma"
import { addMonths } from "@/lib/calculations/month"
import { invoiceMonthForPurchase } from "@/lib/calculations/cardTiming"
import { splitIntoInstallments } from "@/lib/calculations/installments"
import { recalcOpeningBalanceChain } from "@/lib/actions/monthly"
import { cardPurchaseSchema, type CardPurchaseInput } from "@/lib/validation/cardSchemas"

/**
 * Criação de compra de cartão, sem depender de sessão de navegador.
 *
 * Vive fora das Server Actions porque tem dois chamadores: o diálogo da web
 * (autenticado por sessão) e o lançamento rápido do widget do Android
 * (autenticado por token de dispositivo). Duplicar a regra de parcelamento e
 * de mês de fatura nos dois caminhos seria pedir para eles divergirem.
 */

/**
 * No modo `TOTAL` o valor digitado é o da compra inteira e é dividido entre as
 * parcelas, com o centavo residual na última. No modo `INSTALLMENT` o valor é
 * o de cada parcela e o total é a multiplicação.
 */
export function resolvePurchaseAmounts(
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
    slices:
      installmentCount > 1 ? splitIntoInstallments(totalAmount, installmentCount) : [totalAmount],
  }
}

/**
 * A reserva da meta depende da fatura do mês seguinte, então uma compra mexe
 * também na abertura do mês anterior ao afetado.
 */
export async function recalcCardAffectedChain(userId: string, earliestAffectedMonth: Date) {
  await recalcOpeningBalanceChain(userId, addMonths(earliestAffectedMonth, -1))
  await recalcOpeningBalanceChain(userId, earliestAffectedMonth)
}

export function monthFromDate(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

export async function createCardPurchaseForUser(
  userId: string,
  cardId: string,
  input: CardPurchaseInput
): Promise<{ id: string; billingMonth: Date; totalAmount: Prisma.Decimal }> {
  const data = cardPurchaseSchema.parse(input)

  const card = await prisma.card.findFirst({ where: { id: cardId, userId } })
  if (!card) throw new Error("Cartão não encontrado")

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

  await recalcCardAffectedChain(userId, purchaseMonth < billingMonth ? purchaseMonth : billingMonth)

  return { id: purchaseId, billingMonth, totalAmount }
}
