import Link from "next/link"

import type { SerializedCardSummary } from "@/lib/types"
import { formatCurrency } from "@/lib/calculations/format"
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
            <CardContent>
              <p className="text-sm text-muted-foreground">Total do mês</p>
              <p className="text-xl font-semibold">{formatCurrency(card.total)}</p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
