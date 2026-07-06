import { z } from "zod"

export const subscriptionSchema = z.object({
  name: z.string().trim().min(1, "Informe um nome"),
  amount: z.coerce.number().positive("Informe um valor maior que zero"),
  paymentMethod: z.enum(["CASH", "PIX", "TRANSFER", "BOLETO", "CARD", "OTHER"]),
  cardId: z.string().trim().optional().nullable(),
})
export type SubscriptionFormValues = z.input<typeof subscriptionSchema>
export type SubscriptionInput = z.output<typeof subscriptionSchema>
