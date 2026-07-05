import { z } from "zod"

export const cardSchema = z.object({
  name: z.string().trim().min(1, "Informe um nome"),
  closingDay: z.coerce.number().int().min(1).max(31).optional().nullable(),
  creditLimit: z.coerce.number().nonnegative("Informe um valor válido").optional().nullable(),
})
export type CardFormValues = z.input<typeof cardSchema>
export type CardInput = z.output<typeof cardSchema>

export const cardPurchaseSchema = z.object({
  description: z.string().trim().min(1, "Informe uma descrição"),
  amount: z.coerce.number().positive("Informe um valor maior que zero"),
  amountMode: z.enum(["TOTAL", "INSTALLMENT"]),
  purchaseDate: z.string().min(1, "Informe a data"),
  installmentCount: z.coerce.number().int().min(1).max(48),
  hasInterest: z.boolean(),
})
export type CardPurchaseFormValues = z.input<typeof cardPurchaseSchema>
export type CardPurchaseInput = z.output<typeof cardPurchaseSchema>

export const cardGoalSchema = z.object({
  amount: z.coerce.number().nonnegative("Informe um valor válido"),
})
export type CardGoalFormValues = z.input<typeof cardGoalSchema>
export type CardGoalInput = z.output<typeof cardGoalSchema>
