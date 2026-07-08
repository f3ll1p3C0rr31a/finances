import { z } from "zod"

const logoDomainSchema = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => {
    if (!value) return null
    const cleaned = value
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
    return cleaned || null
  })

export const subscriptionSchema = z.object({
  name: z.string().trim().min(1, "Informe um nome"),
  amount: z.coerce.number().positive("Informe um valor maior que zero"),
  currency: z.enum(["BRL", "USD"]),
  exchangeRate: z.coerce.number().positive("Informe uma cotação válida").optional().nullable(),
  paymentMethod: z.enum(["CASH", "PIX", "TRANSFER", "BOLETO", "CARD", "OTHER"]),
  cardId: z.string().trim().optional().nullable(),
  chargeDay: z.coerce.number().int().min(1, "Dia entre 1 e 31").max(31, "Dia entre 1 e 31"),
  logoDomain: logoDomainSchema,
}).superRefine((data, ctx) => {
  if (data.currency === "USD" && !data.exchangeRate) {
    ctx.addIssue({
      code: "custom",
      path: ["exchangeRate"],
      message: "Informe a cotação média do mês",
    })
  }
})
export type SubscriptionFormValues = z.input<typeof subscriptionSchema>
export type SubscriptionInput = z.output<typeof subscriptionSchema>
