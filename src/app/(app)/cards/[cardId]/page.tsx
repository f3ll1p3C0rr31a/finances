import { notFound } from "next/navigation"

import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"
import { listTags } from "@/lib/actions/tags"
import { currentMonth } from "@/lib/calculations/month"
import { bestPurchaseDate } from "@/lib/calculations/cardTiming"
import type { SerializedCardPurchase } from "@/lib/types"
import { NewPurchaseDialog } from "@/components/cards/new-purchase-dialog"
import { NewCardDialog } from "@/components/cards/new-card-dialog"
import { PurchaseList } from "@/components/cards/purchase-list"

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ cardId: string }>
}) {
  const { cardId } = await params
  const userId = await requireUserId()

  const card = await prisma.card.findUnique({ where: { id: cardId, userId } })
  if (!card) {
    notFound()
  }

  const [purchases, allTags] = await Promise.all([
    prisma.cardPurchase.findMany({
      where: { cardId },
      orderBy: { purchaseDate: "desc" },
      include: { tags: { include: { tag: true } } },
    }),
    listTags(userId),
  ])

  const tagRefs = allTags.map((t) => ({ id: t.id, name: t.name }))

  const serialized: SerializedCardPurchase[] = purchases.map((p) => ({
    id: p.id,
    description: p.description,
    totalAmount: p.totalAmount.toNumber(),
    purchaseDate: p.purchaseDate.toISOString(),
    installmentCount: p.installmentCount,
    tags: p.tags.map((t) => ({ id: t.tag.id, name: t.tag.name })),
  }))

  const bestDay = card.closingDay ? bestPurchaseDate(card.closingDay, currentMonth()).getUTCDate() : null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{card.name}</h1>
          <p className="text-sm text-muted-foreground">
            {bestDay
              ? `Fecha dia ${card.closingDay} — melhor dia para comprar: dia ${bestDay}`
              : "Defina o dia de fechamento para ver o melhor dia de compra"}
          </p>
        </div>
        <div className="flex gap-2">
          <NewCardDialog card={card} triggerLabel="Editar cartão" triggerVariant="outline" />
          <NewPurchaseDialog cardId={card.id} allTags={tagRefs} />
        </div>
      </div>
      <PurchaseList purchases={serialized} allTags={tagRefs} />
    </div>
  )
}
