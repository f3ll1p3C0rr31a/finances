import { z } from "zod"

export const subscriptionSchema = z.object({
  name: z.string().trim().min(1, "Informe um nome"),
  amount: z.coerce.number().positive("Informe um valor maior que zero"),
  currency: z.enum(["BRL", "USD"]),
  exchangeRate: z.coerce.number().positive("Informe uma cotação válida").optional().nullable(),
  paymentMethod: z.enum(["CASH", "PIX", "TRANSFER", "BOLETO", "CARD", "OTHER"]),
  cardId: z.string().trim().optional().nullable(),
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
