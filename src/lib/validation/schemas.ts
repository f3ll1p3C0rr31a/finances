import { z } from "zod"

const amountSchema = z.coerce.number().positive("Informe um valor maior que zero")
const dueDayTypeSchema = z.enum(["CALENDAR_DAY", "BUSINESS_DAY"])

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
  paymentMethod: z.enum(["CASH", "PIX", "TRANSFER", "CARD", "OTHER"]),
  pixKeyId: z.string().trim().optional().nullable(),
})
export type ExpenseEntryFormValues = z.input<typeof expenseEntrySchema>
export type ExpenseEntryInput = z.output<typeof expenseEntrySchema>
