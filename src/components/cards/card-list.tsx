import Link from "next/link"

import type { SerializedCardSummary } from "@/lib/types"
import { MoneyText } from "@/components/ui/money-text"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function CardList({ cards }: { cards: SerializedCardSummary[] }) {
  if (cards.length === 0) {
    return <p className="text-muted-foreground">Nenhum cartão cadastrado ainda.</p>
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <Link key={card.id} href={`/cards/${card.id}`}>
          <Card className="transition-colors hover:bg-muted/50">
            <CardHeader>
              <CardTitle>{card.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Total do mês</p>
                <p className="text-xl font-semibold">
                  <MoneyText value={-card.total} />
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {card.accountName ? `${card.accountName} · ` : ""}
                {card.closingDay ? `Fecha dia ${card.closingDay}` : "Sem fechamento clássico"}
                {" · "}
                {card.bestPurchaseDay
                  ? `melhor compra dia ${card.bestPurchaseDay}`
                  : "melhor dia não definido"}
                {card.paymentDay ? ` · vence dia ${card.paymentDay}` : ""}
              </p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
