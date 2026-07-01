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
