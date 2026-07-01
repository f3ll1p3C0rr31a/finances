import Link from "next/link"

import type { SerializedCardSummary } from "@/lib/types"
import { formatCurrency } from "@/lib/calculations/format"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function CardsSummary({ cards }: { cards: SerializedCardSummary[] }) {
  if (cards.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Cartões</h2>
        <Link href="/cards" className="text-sm text-muted-foreground hover:underline">
          Gerenciar compras →
        </Link>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cartão</TableHead>
            <TableHead className="text-right">Total do mês</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cards.map((card) => (
            <TableRow key={card.id}>
              <TableCell className="font-medium">{card.name}</TableCell>
              <TableCell className="text-right">{formatCurrency(card.total)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
