import { Prisma } from "@/generated/prisma/client"

type DecimalInput = Prisma.Decimal | number | string

export function sumAmounts(values: DecimalInput[]): Prisma.Decimal {
  return values.reduce(
    (acc: Prisma.Decimal, value) => acc.add(value),
    new Prisma.Decimal(0)
  )
}
