import { revalidatePath } from "next/cache"

import { userIdFromRequest } from "@/lib/services/deviceTokens"
import { prisma } from "@/lib/prisma"
import { createCardPurchaseForUser } from "@/lib/services/cardPurchase"
import { cardPurchaseSchema } from "@/lib/validation/cardSchemas"
import { formatMonthLabel, today } from "@/lib/calculations/month"

export const dynamic = "force-dynamic"

/**
 * Lançamento rápido de compra de cartão a partir do widget.
 *
 * Passa pelo mesmo serviço e pelo mesmo schema Zod do diálogo da web, então a
 * regra de parcelamento e a de mês de fatura são exatamente as mesmas. A data
 * é opcional: sem ela, hoje — que é o caso de uso, lançar no momento da
 * compra.
 */
export async function POST(request: Request) {
  const userId = await userIdFromRequest(request)
  if (!userId) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 })
  }

  const payload = body as Record<string, unknown>
  const cardId = typeof payload?.cardId === "string" ? payload.cardId : null
  if (!cardId) {
    return Response.json({ error: "card_required" }, { status: 400 })
  }

  const now = today()
  const parsed = cardPurchaseSchema.safeParse({
    description: payload.description ?? "Compra rápida",
    amount: payload.amount,
    amountMode: payload.amountMode ?? "TOTAL",
    installmentCount: payload.installmentCount ?? 1,
    hasInterest: payload.hasInterest ?? false,
    purchaseDate:
      typeof payload.purchaseDate === "string"
        ? payload.purchaseDate
        : now.toISOString().slice(0, 10),
  })
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_input", issues: parsed.error.issues.map((i) => i.message) },
      { status: 422 }
    )
  }

  const requestedTagIds = Array.isArray(payload.tagIds)
    ? payload.tagIds.filter((id): id is string => typeof id === "string")
    : []

  try {
    const purchase = await createCardPurchaseForUser(userId, cardId, parsed.data)

    if (requestedTagIds.length > 0) {
      // Só as etiquetas que são mesmo do usuário: o id vem do aparelho e não
      // dá para confiar nele sem conferir.
      const owned = await prisma.tag.findMany({
        where: { userId, id: { in: requestedTagIds } },
        select: { id: true },
      })
      if (owned.length > 0) {
        await prisma.cardPurchaseTag.createMany({
          data: owned.map(({ id }) => ({ purchaseId: purchase.id, tagId: id })),
        })
      }
    }

    revalidatePath("/cards", "layout")
    revalidatePath("/dashboard", "layout")

    return Response.json({
      id: purchase.id,
      totalAmount: purchase.totalAmount.toNumber(),
      billingMonthLabel: formatMonthLabel(purchase.billingMonth),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "erro"
    return Response.json({ error: message }, { status: 400 })
  }
}
