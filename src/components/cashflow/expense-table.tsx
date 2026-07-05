"use client"

import Link from "next/link"
import { useTransition } from "react"
import { toast } from "sonner"

import type { SerializedCardSummary, SerializedExpenseEntry } from "@/lib/types"
import type { TagOption } from "@/components/tags/tag-multi-select"
import { setExpensePaid, deleteExpenseEntry } from "@/lib/actions/expense"
import { setCardInvoicePaid } from "@/lib/actions/cardPayments"
import { monthFromKey } from "@/lib/calculations/month"
import { formatDueDay } from "@/lib/calculations/format"
import { MoneyText } from "@/components/ui/money-text"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ExpenseEntryDialog } from "@/components/cashflow/expense-entry-dialog"

const CATEGORY_LABELS = {
  FIXED: "Fixa",
  VARIABLE: "Variável",
  ONE_OFF: "Avulsa",
}

const PAYMENT_METHOD_LABELS = {
  CASH: "Dinheiro",
  PIX: "Pix",
  TRANSFER: "Transferência",
  CARD: "Cartão",
  OTHER: "Outro",
}

export function ExpenseTable({
  month,
  entries,
  cards,
  cardReserve,
  allTags,
  pixPayees,
}: {
  month: string
  entries: SerializedExpenseEntry[]
  cards: SerializedCardSummary[]
  cardReserve: number
  allTags: TagOption[]
  pixPayees: { id: string; label: string }[]
}) {
  const [pending, startTransition] = useTransition()

  function togglePaid(id: string, paid: boolean) {
    startTransition(async () => {
      try {
        await setExpensePaid(id, paid)
      } catch {
        toast.error("Não foi possível atualizar.")
      }
    })
  }

  function toggleCardPaid(cardId: string, paid: boolean) {
    startTransition(async () => {
      try {
        await setCardInvoicePaid(cardId, monthFromKey(month), paid)
      } catch {
        toast.error("Não foi possível atualizar o pagamento da fatura.")
      }
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      try {
        const result = await deleteExpenseEntry(id)
        toast.success(
          result.recurring
            ? `Despesa recorrente removida (${result.deletedEntries} meses).`
            : "Despesa removida."
        )
      } catch {
        toast.error("Não foi possível remover.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Despesas</h2>
        <ExpenseEntryDialog
          month={month}
          triggerLabel="Nova despesa"
          triggerSize="sm"
          allTags={allTags}
          pixPayees={pixPayees}
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Dia</TableHead>
            <TableHead>Pago por</TableHead>
            <TableHead>Forma</TableHead>
            <TableHead>Etiquetas</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="text-center">Pago</TableHead>
            <TableHead className="w-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {cards.map((card) => (
            <TableRow key={`card-${card.id}`} className="bg-muted/35">
              <TableCell className="font-medium">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/cards/${card.id}`} className="hover:underline">
                    {card.name}
                  </Link>
                  <Badge variant="outline">Calculado automaticamente</Badge>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">Variável</Badge>
              </TableCell>
              <TableCell>—</TableCell>
              <TableCell>Eu</TableCell>
              <TableCell className="text-sm text-muted-foreground">Cartão</TableCell>
              <TableCell>
                <Badge variant="outline">Fatura do cartão</Badge>
              </TableCell>
              <TableCell className="text-right">
                <MoneyText value={-card.total} />
              </TableCell>
              <TableCell className="text-center">
                <Switch
                  checked={card.paid}
                  disabled={pending}
                  onCheckedChange={(checked) => toggleCardPaid(card.id, checked)}
                />
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="xs" render={<Link href={`/cards/${card.id}`} />}>
                  Gerenciar
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {cardReserve > 0 ? (
            <TableRow className="bg-muted/20">
              <TableCell className="font-medium">
                <div className="flex flex-wrap items-center gap-2">
                  Disponível para gastar nos cartões
                  <Badge variant="outline">Despesa prevista pela meta</Badge>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">Variável</Badge>
              </TableCell>
              <TableCell>—</TableCell>
              <TableCell>Eu</TableCell>
              <TableCell className="text-sm text-muted-foreground">Cartão</TableCell>
              <TableCell>
                <Badge variant="outline">Meta dos cartões</Badge>
              </TableCell>
              <TableCell className="text-right">
                <MoneyText value={-cardReserve} />
              </TableCell>
              <TableCell className="text-center text-muted-foreground">—</TableCell>
              <TableCell />
            </TableRow>
          ) : null}
          {entries.length === 0 && cards.length === 0 && cardReserve === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground">
                Nenhuma despesa neste mês.
              </TableCell>
            </TableRow>
          ) : entries.length > 0 ? (
            entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-medium">
                  <div className="flex flex-wrap items-center gap-2">
                    {entry.name}
                    {entry.uncertain && !entry.paid ? (
                      <Badge variant="outline">Incerta · avança até pagar</Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{CATEGORY_LABELS[entry.category]}</Badge>
                </TableCell>
                <TableCell>
                  {entry.uncertain && !entry.paid
                    ? "Sem data"
                    : formatDueDay(entry.dueDay, entry.dueDayType)}
                </TableCell>
                <TableCell>
                  {entry.paidBy === "THIRD_PARTY" ? (
                    <Badge variant="outline">{entry.paidByName || "Terceiro"}</Badge>
                  ) : (
                    "Eu"
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {PAYMENT_METHOD_LABELS[entry.paymentMethod]}
                  {entry.pixKeyLabel ? (
                    <span className="block text-xs">→ {entry.pixKeyLabel}</span>
                  ) : null}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {entry.tags.map((tag) => (
                      <Badge key={tag.id} variant="secondary">
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <MoneyText value={-entry.amount} />
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={entry.paid}
                    disabled={pending}
                    onCheckedChange={(checked) => togglePaid(entry.id, checked)}
                  />
                </TableCell>
                <TableCell className="flex items-center justify-end gap-1">
                  <ExpenseEntryDialog
                    month={month}
                    entry={entry}
                    triggerLabel="Editar"
                    triggerVariant="ghost"
                    triggerSize="xs"
                    allTags={allTags}
                    pixPayees={pixPayees}
                  />
                  <Button
                    variant="ghost"
                    size="xs"
                    disabled={pending}
                    onClick={() => remove(entry.id)}
                  >
                    Excluir
                  </Button>
                </TableCell>
              </TableRow>
            ))
          ) : null}
        </TableBody>
      </Table>
    </div>
  )
}
