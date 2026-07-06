import { notFound } from "next/navigation"

import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"
import { listTags } from "@/lib/actions/tags"
import { getCardMonthlyHistory } from "@/lib/actions/chart"
import { currentMonth } from "@/lib/calculations/month"
import { bestPurchaseDateForCard } from "@/lib/calculations/cardTiming"
import type { SerializedCardPurchase } from "@/lib/types"
import { MoneyText } from "@/components/ui/money-text"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { NewPurchaseDialog } from "@/components/cards/new-purchase-dialog"
import { NewCardDialog } from "@/components/cards/new-card-dialog"
import { PurchaseList } from "@/components/cards/purchase-list"
import { CardMonthlyChart } from "@/components/chart/card-monthly-chart"

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

  const [purchases, allTags, monthlyHistory] = await Promise.all([
    prisma.cardPurchase.findMany({
      where: { cardId },
      orderBy: { purchaseDate: "desc" },
      include: { tags: { include: { tag: true } }, installments: { orderBy: { installmentNo: "asc" } } },
    }),
    listTags(userId),
    getCardMonthlyHistory(userId, cardId),
  ])

  const tagRefs = allTags.map((t) => ({ id: t.id, name: t.name }))
  const nowMonth = currentMonth()

  const serialized: SerializedCardPurchase[] = purchases.map((p) => {
    const purchaseMonth = new Date(Date.UTC(p.purchaseDate.getUTCFullYear(), p.purchaseDate.getUTCMonth(), 1))

    let paidInstallments: number
    let installmentAmount: number
    let remainingAmount: number

    if (p.installmentCount > 1) {
      paidInstallments = p.installments.filter((i) => i.month < nowMonth).length
      installmentAmount = (p.installments[0]?.amount ?? p.totalAmount.div(p.installmentCount)).toNumber()
      remainingAmount = p.installments
        .filter((i) => i.month >= nowMonth)
        .reduce((sum, i) => sum + i.amount.toNumber(), 0)
    } else {
      paidInstallments = purchaseMonth < nowMonth ? 1 : 0
      installmentAmount = p.totalAmount.toNumber()
      remainingAmount = purchaseMonth >= nowMonth ? p.totalAmount.toNumber() : 0
    }

    return {
      id: p.id,
      description: p.description,
      totalAmount: p.totalAmount.toNumber(),
      installmentAmount,
      remainingAmount,
      purchaseDate: p.purchaseDate.toISOString(),
      installmentCount: p.installmentCount,
      hasInterest: p.hasInterest,
      paidInstallments,
      remainingInstallments: p.installmentCount - paidInstallments,
      tags: p.tags.map((t) => ({ id: t.tag.id, name: t.tag.name })),
    }
  })

  const remainingDebt = serialized.reduce((sum, p) => sum + p.remainingAmount, 0)
  const creditLimit = card.creditLimit ? card.creditLimit.toNumber() : null
  const availableLimit = creditLimit != null ? creditLimit - remainingDebt : null

  const bestDay = bestPurchaseDateForCard(card, currentMonth())?.getUTCDate() ?? null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{card.name}</h1>
          <p className="text-sm text-muted-foreground">
            {bestDay
              ? `${card.closingDay ? `Fecha dia ${card.closingDay}` : "Sem fechamento clássico"} — melhor dia para comprar: dia ${bestDay}`
              : "Defina o fechamento ou informe manualmente o melhor dia de compra"}
          </p>
        </div>
        <div className="flex gap-2">
          <NewCardDialog
            card={{
              id: card.id,
              name: card.name,
              closingDay: card.closingDay,
              bestPurchaseDay: card.bestPurchaseDay,
              creditLimit,
            }}
            triggerLabel="Editar cartão"
            triggerVariant="outline"
          />
          <NewPurchaseDialog cardId={card.id} allTags={tagRefs} />
        </div>
      </div>
      {creditLimit != null ? (
        <Card>
          <CardHeader>
            <CardTitle>Limite de crédito</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-3 gap-2 text-sm">
              <dt className="text-muted-foreground">Limite total</dt>
              <dt className="text-muted-foreground">Débito restante</dt>
              <dt className="font-medium">Limite livre</dt>
              <dd className="text-right"><MoneyText value={creditLimit} /></dd>
              <dd className="text-right"><MoneyText value={-remainingDebt} /></dd>
              <dd className="text-right font-medium"><MoneyText value={availableLimit ?? 0} /></dd>
            </dl>
          </CardContent>
        </Card>
      ) : null}
      <PurchaseList purchases={serialized} allTags={tagRefs} cardId={card.id} />
      {monthlyHistory.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Gastos ao longo dos meses</CardTitle>
          </CardHeader>
          <CardContent>
            <CardMonthlyChart data={monthlyHistory} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
