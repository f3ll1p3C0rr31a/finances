import { notFound } from "next/navigation"

import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"
import type { SerializedCardPurchase } from "@/lib/types"
import { NewPurchaseDialog } from "@/components/cards/new-purchase-dialog"
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

  const purchases = await prisma.cardPurchase.findMany({
    where: { cardId },
    orderBy: { purchaseDate: "desc" },
  })

  const serialized: SerializedCardPurchase[] = purchases.map((p) => ({
    id: p.id,
    description: p.description,
    totalAmount: p.totalAmount.toNumber(),
    purchaseDate: p.purchaseDate.toISOString(),
    installmentCount: p.installmentCount,
  }))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{card.name}</h1>
        <NewPurchaseDialog cardId={card.id} />
      </div>
      <PurchaseList purchases={serialized} />
    </div>
  )
}
