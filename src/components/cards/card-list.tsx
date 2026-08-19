import Link from "next/link"

import type { SerializedCardSummary } from "@/lib/types"
import { MoneyText } from "@/components/ui/money-text"
import { BankCardVisual } from "@/components/cards/bank-card-visual"

export function CardList({ cards }: { cards: SerializedCardSummary[] }) {
  if (cards.length === 0) {
    return <p className="text-muted-foreground">Nenhum cartão cadastrado ainda.</p>
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <Link
          key={card.id}
          href={`/cards/${card.id}?month=${card.invoiceMonth}`}
          className="group flex flex-col gap-2"
        >
          <BankCardVisual
            compact
            name={card.name}
            accountName={card.accountName}
            cardNumber={card.cardNumber}
          />
          <div className="flex items-baseline justify-between px-1">
            <div>
              <p className="text-xs text-muted-foreground">
                {card.invoiceOpen ? "Fatura em aberto" : "Fatura"} · {card.invoiceMonthLabel}
              </p>
              <p className="text-lg font-semibold">
                <MoneyText value={-card.total} />
              </p>
            </div>
            {card.paid ? (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Paga
              </span>
            ) : card.invoiceOpen ? (
              <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-xs font-medium text-sky-600 dark:text-sky-400">
                Aberta
              </span>
            ) : null}
          </div>
          <p className="px-1 text-xs text-muted-foreground">
            {card.closingDay ? `Fecha dia ${card.closingDay}` : "Sem fechamento clássico"}
            {" · "}
            {card.bestPurchaseDay
              ? `melhor compra dia ${card.bestPurchaseDay}`
              : "melhor dia não definido"}
            {card.paymentDay ? ` · vence dia ${card.paymentDay}` : ""}
          </p>
        </Link>
      ))}
    </div>
  )
}
