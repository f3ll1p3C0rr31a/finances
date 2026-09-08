import { Prisma } from "@/generated/prisma/client"

/**
 * Splits a total amount into `count` installments whose sum exactly equals
 * the total, doing the math in integer cents to avoid floating point drift.
 * Any remainder cent is added to the last installment.
 */
export function splitIntoInstallments(
  total: Prisma.Decimal | number | string,
  count: number
): Prisma.Decimal[] {
  const totalCents = new Prisma.Decimal(total).mul(100).round()
  const baseCents = totalCents.dividedToIntegerBy(count)
  const remainderCents = totalCents.sub(baseCents.mul(count))

  return Array.from({ length: count }, (_, i) => {
    const cents = i === count - 1 ? baseCents.add(remainderCents) : baseCents
    return cents.div(100)
  })
}

export type AmountMode = "TOTAL" | "INSTALLMENT"

/**
 * Resolves the (total, per-installment slices) pair depending on whether the
 * user typed the whole debt or the value of a single installment. In
 * INSTALLMENT mode every slice is exactly the typed amount (no rounding split
 * needed); in TOTAL mode the total is divided with the remainder cent landing
 * on the last slice.
 */
export function resolveInstallmentAmounts(
  amount: Prisma.Decimal | number | string,
  amountMode: AmountMode,
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
