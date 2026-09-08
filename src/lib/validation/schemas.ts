import { z } from "zod"

const amountSchema = z.coerce.number().positive("Informe um valor maior que zero")
const dueDayTypeSchema = z.enum(["CALENDAR_DAY", "BUSINESS_DAY"])

/**
 * A boleto's "linha digitável" (or any reference the bank prints on it).
 * Digit-only input is normalized to bare digits so it can be copied and
 * pasted into a banking app; anything else is kept as typed.
 */
const boletoNumberSchema = z
  .string()
  .optional()
  .nullable()
  .transform((value) => {
    const trimmed = (value ?? "").trim()
    if (!trimmed) return null
    return /^[\d\s.]+$/.test(trimmed) ? trimmed.replace(/\D/g, "") : trimmed
  })
  .refine((value) => value == null || value.length <= 64, {
    message: "Número do boleto muito longo",
  })

export const incomeEntrySchema = z.object({
  name: z.string().trim().min(1, "Informe um nome"),
  amount: amountSchema,
  dueDay: z.coerce.number().int().min(1).max(31).optional().nullable(),
  dueDayType: dueDayTypeSchema,
  recurring: z.boolean(),
  uncertain: z.boolean(),
})
export type IncomeEntryFormValues = z.input<typeof incomeEntrySchema>
export type IncomeEntryInput = z.output<typeof incomeEntrySchema>

export const expenseEntrySchema = z.object({
  name: z.string().trim().min(1, "Informe um nome"),
  amount: amountSchema,
  dueDay: z.coerce.number().int().min(1).max(31).optional().nullable(),
  dueDayType: dueDayTypeSchema,
  category: z.enum(["FIXED", "VARIABLE", "ONE_OFF"]),
  recurring: z.boolean(),
  uncertain: z.boolean(),
  paidBy: z.enum(["SELF", "THIRD_PARTY"]),
  paidByName: z.string().trim().optional().nullable(),
  paymentMethod: z.enum(["CASH", "PIX", "TRANSFER", "BOLETO", "CARD", "OTHER"]),
  pixKeyId: z.string().trim().optional().nullable(),
  externalLink: z
    .union([z.literal(""), z.string().trim().url("Informe um link válido")])
    .optional()
    .nullable()
    .transform((value) => value || null),
  boletoNumber: boletoNumberSchema,
  /** 1 = single payment. Only honored when creating a non-recurring, certain expense. */
  installmentCount: z.coerce.number().int().min(1).max(48),
  /** Whether `amount` is the whole debt or the value of one installment. */
  amountMode: z.enum(["TOTAL", "INSTALLMENT"]),
})
export type ExpenseEntryFormValues = z.input<typeof expenseEntrySchema>
export type ExpenseEntryInput = z.output<typeof expenseEntrySchema>

/** Boleto/portal references editable straight from the expense row. */
export const expenseReferencesSchema = z.object({
  externalLink: z
    .union([z.literal(""), z.string().trim().url("Informe um link válido")])
    .optional()
    .nullable()
    .transform((value) => value || null),
  boletoNumber: boletoNumberSchema,
})
export type ExpenseReferencesInput = z.output<typeof expenseReferencesSchema>
