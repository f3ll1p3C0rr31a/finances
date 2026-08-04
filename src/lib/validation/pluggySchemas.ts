import { z } from "zod"

export const pluggyItemSchema = z.object({
  id: z.string().min(1),
  connector: z.object({
    id: z.coerce.number().int(),
    name: z.string().min(1),
    imageUrl: z.string().optional().nullable(),
  }),
  status: z.string().min(1),
  executionStatus: z.string().optional().nullable(),
})
export type PluggyItemInput = z.output<typeof pluggyItemSchema>

export const linkTargetSchema = z
  .object({
    accountId: z.string().trim().optional().nullable(),
    cardId: z.string().trim().optional().nullable(),
  })
  .transform((value) => ({
    accountId: value.accountId || null,
    cardId: value.cardId || null,
  }))
  .refine((value) => !(value.accountId && value.cardId), {
    message: "Vincule a uma conta ou a um cartão, não a ambos",
  })
export type LinkTargetInput = z.output<typeof linkTargetSchema>
