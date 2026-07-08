import { z } from "zod"

const optionalDaySchema = z
  .union([z.literal(""), z.coerce.number().int().min(1).max(31)])
  .optional()
  .nullable()
  .transform((value) => (value === "" || value == null ? null : value))

const cardNumberSchema = z
  .string()
  .optional()
  .nullable()
  .transform((value) => {
    const digits = (value ?? "").replace(/\D/g, "")
    return digits || null
  })
  .refine((value) => value == null || (value.length >= 12 && value.length <= 19), {
    message: "Número do cartão deve ter entre 12 e 19 dígitos",
  })

const cvvSchema = z
  .string()
  .optional()
  .nullable()
  .transform((value) => {
    const digits = (value ?? "").replace(/\D/g, "")
    return digits || null
  })
  .refine((value) => value == null || value.length === 3 || value.length === 4, {
    message: "CVV deve ter 3 ou 4 dígitos",
  })

const expiryMonthSchema = z
  .union([z.literal(""), z.coerce.number().int().min(1, "Mês inválido").max(12, "Mês inválido")])
  .optional()
  .nullable()
  .transform((value) => (value === "" || value == null ? null : value))

const expiryYearSchema = z
  .union([z.literal(""), z.coerce.number().int().min(0).max(2099, "Ano inválido")])
  .optional()
  .nullable()
  .transform((value) => {
    if (value === "" || value == null) return null
    return value < 100 ? value + 2000 : value
  })

export const cardSchema = z.object({
  name: z.string().trim().min(1, "Informe um nome"),
  accountId: z.string().trim().optional().nullable().transform((value) => value || null),
  closingDay: optionalDaySchema,
  bestPurchaseDay: optionalDaySchema,
  paymentDay: optionalDaySchema,
  creditLimit: z.coerce.number().nonnegative("Informe um valor válido").optional().nullable(),
  cardNumber: cardNumberSchema,
  cvv: cvvSchema,
  expiryMonth: expiryMonthSchema,
  expiryYear: expiryYearSchema,
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
