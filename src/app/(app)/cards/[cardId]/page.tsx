import { notFound } from "next/navigation"

import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"
import { listTags } from "@/lib/actions/tags"
import { getCardMonthlyHistory, getCardMonthlyWindow } from "@/lib/actions/chart"
import { currentMonth, monthFromKey } from "@/lib/calculations/month"
import { bestPurchaseDateForCard } from "@/lib/calculations/cardTiming"
import type { SerializedCardPurchase } from "@/lib/types"
import { MoneyText } from "@/components/ui/money-text"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { NewPurchaseDialog } from "@/components/cards/new-purchase-dialog"
import { NewCardDialog } from "@/components/cards/new-card-dialog"
import { CardMonthNav } from "@/components/cards/card-month-nav"
import { PurchaseList } from "@/components/cards/purchase-list"
import { CardMonthlyChart } from "@/components/chart/card-monthly-chart"

const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/

export default async function CardDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ cardId: string }>
  searchParams: Promise<{ month?: string | string[] }>
}) {
  const { cardId } = await params
  const queryMonth = (await searchParams).month
  const selectedMonth =
    typeof queryMonth === "string" && MONTH_KEY_PATTERN.test(queryMonth)
      ? monthFromKey(queryMonth)
      : currentMonth()
  const userId = await requireUserId()

  const card = await prisma.card.findUnique({ where: { id: cardId, userId } })
  if (!card) {
    notFound()
  }

  const [purchases, allTags, monthlyHistory, upcomingMonths] = await Promise.all([
    prisma.cardPurchase.findMany({
      where: { cardId },
      orderBy: { purchaseDate: "desc" },
      include: { tags: { include: { tag: true } }, installments: { orderBy: { installmentNo: "asc" } } },
    }),
    listTags(userId),
    getCardMonthlyHistory(userId, cardId),
    getCardMonthlyWindow(userId, cardId, selectedMonth, 12),
  ])

  const tagRefs = allTags.map((t) => ({ id: t.id, name: t.name }))
  const nowMonth = currentMonth()

  const remainingDebt = purchases.reduce((sum, p) => {
    const billingMonth =
      p.billingMonth ??
      new Date(Date.UTC(p.purchaseDate.getUTCFullYear(), p.purchaseDate.getUTCMonth(), 1))

    if (p.installmentCount > 1) {
      return (
        sum +
        p.installments
          .filter((i) => i.month >= nowMonth)
          .reduce((installmentSum, i) => installmentSum + i.amount.toNumber(), 0)
      )
    }

    return billingMonth >= nowMonth ? sum + p.totalAmount.toNumber() : sum
  }, 0)

  const serialized: SerializedCardPurchase[] = purchases.flatMap((p) => {
    const billingMonth =
      p.billingMonth ??
      new Date(Date.UTC(p.purchaseDate.getUTCFullYear(), p.purchaseDate.getUTCMonth(), 1))
    const currentInstallment =
      p.installmentCount > 1
        ? p.installments.find((i) => i.month.getTime() === selectedMonth.getTime())
        : null

    if (p.installmentCount > 1 && !currentInstallment) return []
    if (p.installmentCount === 1 && billingMonth.getTime() !== selectedMonth.getTime()) return []

    let paidInstallments: number
    let installmentAmount: number
    let remainingAmount: number

    if (p.installmentCount > 1) {
      paidInstallments = p.installments.filter((i) => i.month < selectedMonth).length
      installmentAmount = (currentInstallment?.amount ?? p.totalAmount.div(p.installmentCount)).toNumber()
      remainingAmount = p.installments
        .filter((i) => i.month >= selectedMonth)
        .reduce((sum, i) => sum + i.amount.toNumber(), 0)
    } else {
      paidInstallments = billingMonth < selectedMonth ? 1 : 0
      installmentAmount = p.totalAmount.toNumber()
      remainingAmount = billingMonth >= selectedMonth ? p.totalAmount.toNumber() : 0
    }

    return [{
      id: p.id,
      description: p.description,
      totalAmount: p.totalAmount.toNumber(),
      installmentAmount,
      remainingAmount,
      purchaseDate: p.purchaseDate.toISOString(),
      billingMonth: billingMonth.toISOString(),
      installmentCount: p.installmentCount,
      currentInstallmentNo: currentInstallment?.installmentNo ?? null,
      hasInterest: p.hasInterest,
      paidInstallments,
      remainingInstallments: p.installmentCount - paidInstallments,
      tags: p.tags.map((t) => ({ id: t.tag.id, name: t.tag.name })),
    }]
  })

  const creditLimit = card.creditLimit ? card.creditLimit.toNumber() : null
  const availableLimit = creditLimit != null ? creditLimit - remainingDebt : null

  const bestDay = bestPurchaseDateForCard(card, selectedMonth)?.getUTCDate() ?? null
  const cardTimingLabel = bestDay
    ? `${
        card.closingDay ? `Fecha dia ${card.closingDay}` : "Sem fechamento clássico"
      }${card.paymentDay ? ` · vence dia ${card.paymentDay}` : ""} — melhor dia para comprar: dia ${bestDay}`
    : "Defina o fechamento ou informe manualmente o melhor dia de compra"

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{card.name}</h1>
          <p className="text-sm text-muted-foreground">{cardTimingLabel}</p>
        </div>
        <div className="flex gap-2">
          <NewCardDialog
            card={{
              id: card.id,
              name: card.name,
              closingDay: card.closingDay,
              bestPurchaseDay: card.bestPurchaseDay,
              paymentDay: card.paymentDay,
              creditLimit,
            }}
            triggerLabel="Editar cartão"
            triggerVariant="outline"
          />
          <NewPurchaseDialog
            cardId={card.id}
            allTags={tagRefs}
            cardCycle={{ closingDay: card.closingDay, paymentDay: card.paymentDay }}
          />
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
      <CardMonthNav month={selectedMonth} basePath={`/cards/${card.id}`} />
      <PurchaseList
        purchases={serialized}
        allTags={tagRefs}
        cardId={card.id}
        cardCycle={{ closingDay: card.closingDay, paymentDay: card.paymentDay }}
      />
      {upcomingMonths.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Próximos 12 meses</CardTitle>
          </CardHeader>
          <CardContent>
            <CardMonthlyChart data={upcomingMonths} />
          </CardContent>
        </Card>
      ) : null}
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
