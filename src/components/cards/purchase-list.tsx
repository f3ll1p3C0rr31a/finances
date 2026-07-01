"use client"

import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"

import type { SerializedCardPurchase } from "@/lib/types"
import type { TagOption } from "@/components/tags/tag-multi-select"
import { deleteCardPurchase } from "@/lib/actions/cards"
import { bulkSetCardPurchaseTags } from "@/lib/actions/tags"
import { MoneyText } from "@/components/ui/money-text"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { TagMultiSelect } from "@/components/tags/tag-multi-select"
import { PurchaseTagsDialog } from "@/components/cards/purchase-tags-dialog"
import { NewPurchaseDialog } from "@/components/cards/new-purchase-dialog"

type SortKey = "date" | "value" | "installments" | "remaining"

const SORT_LABELS: Record<SortKey, string> = {
  date: "Data",
  value: "Valor",
  installments: "Parcelas",
  remaining: "Faltam",
}

function sortValue(purchase: SerializedCardPurchase, key: SortKey): number {
  switch (key) {
    case "date":
      return new Date(purchase.purchaseDate).getTime()
    case "value":
      return purchase.installmentAmount
    case "installments":
      return purchase.installmentCount
    case "remaining":
      return purchase.remainingInstallments
  }
}

function SortableHead({
  sortKey,
  currentSort,
  onToggle,
  children,
}: {
  sortKey: SortKey
  currentSort: { key: SortKey; direction: "asc" | "desc" }
  onToggle: (key: SortKey) => void
  children: React.ReactNode
}) {
  const active = currentSort.key === sortKey
  return (
    <TableHead
      className="cursor-pointer select-none whitespace-nowrap"
      onClick={() => onToggle(sortKey)}
    >
      {children}
      {active ? (currentSort.direction === "asc" ? " ▲" : " ▼") : ""}
    </TableHead>
  )
}

export function PurchaseList({
  purchases,
  allTags,
  cardId,
}: {
  purchases: SerializedCardPurchase[]
  allTags: TagOption[]
  cardId: string
}) {
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useState<string[]>([])
  const [bulkTagIds, setBulkTagIds] = useState<string[]>([])
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({
    key: "date",
    direction: "desc",
  })

  const sorted = useMemo(() => {
    const copy = [...purchases]
    copy.sort((a, b) => {
      const diff = sortValue(a, sort.key) - sortValue(b, sort.key)
      return sort.direction === "asc" ? diff : -diff
    })
    return copy
  }, [purchases, sort])

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "desc" }
    )
  }

  function toggleSelect(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.length === purchases.length ? [] : purchases.map((p) => p.id)))
  }

  function remove(id: string) {
    startTransition(async () => {
      try {
        await deleteCardPurchase(id)
        toast.success("Compra removida.")
      } catch {
        toast.error("Não foi possível remover.")
      }
    })
  }

  function applyBulkTags() {
    startTransition(async () => {
      try {
        await bulkSetCardPurchaseTags(selected, bulkTagIds)
        toast.success("Etiquetas aplicadas.")
        setSelected([])
        setBulkTagIds([])
      } catch {
        toast.error("Não foi possível aplicar as etiquetas.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {selected.length > 0 ? (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
          <div className="min-w-56 flex-1">
            <p className="mb-1 text-sm font-medium">
              {selected.length} selecionada(s) — aplicar etiquetas
            </p>
            <TagMultiSelect allTags={allTags} selectedIds={bulkTagIds} onChange={setBulkTagIds} />
          </div>
          <Button onClick={applyBulkTags} disabled={pending}>
            Aplicar
          </Button>
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Clique nos cabeçalhos para ordenar por {Object.values(SORT_LABELS).join(", ")}.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-0">
              <Checkbox
                checked={purchases.length > 0 && selected.length === purchases.length}
                onCheckedChange={toggleSelectAll}
              />
            </TableHead>
            <TableHead>Descrição</TableHead>
            <SortableHead sortKey="date" currentSort={sort} onToggle={toggleSort}>Data</SortableHead>
            <TableHead>Etiquetas</TableHead>
            <SortableHead sortKey="installments" currentSort={sort} onToggle={toggleSort}>Parcelas</SortableHead>
            <SortableHead sortKey="remaining" currentSort={sort} onToggle={toggleSort}>Faltam</SortableHead>
            <SortableHead sortKey="value" currentSort={sort} onToggle={toggleSort}>Parcela</SortableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="w-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground">
                Nenhuma compra registrada.
              </TableCell>
            </TableRow>
          ) : (
            sorted.map((purchase) => {
              const progress =
                purchase.installmentCount > 0
                  ? (purchase.paidInstallments / purchase.installmentCount) * 100
                  : 0
              return (
                <TableRow key={purchase.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.includes(purchase.id)}
                      onCheckedChange={() => toggleSelect(purchase.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {purchase.description}{" "}
                    {purchase.hasInterest ? (
                      <Badge variant="destructive">c/ juros</Badge>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {new Date(purchase.purchaseDate).toLocaleDateString("pt-BR", {
                      timeZone: "UTC",
                    })}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      {purchase.tags.map((tag) => (
                        <Badge key={tag.id} variant="secondary">
                          {tag.name}
                        </Badge>
                      ))}
                      <PurchaseTagsDialog
                        purchaseId={purchase.id}
                        currentTagIds={purchase.tags.map((t) => t.id)}
                        allTags={allTags}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    {purchase.installmentCount > 1 ? `${purchase.installmentCount}x` : "À vista"}
                  </TableCell>
                  <TableCell className="w-32">
                    {purchase.installmentCount > 1 ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">
                          {purchase.paidInstallments}/{purchase.installmentCount}
                        </span>
                        <div className="h-1.5 w-full rounded-full bg-muted">
                          <div
                            className="h-1.5 rounded-full bg-primary"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {purchase.remainingInstallments > 0 ? "Pendente" : "Concluída"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <MoneyText value={-purchase.installmentAmount} />
                  </TableCell>
                  <TableCell className="text-right">
                    <MoneyText value={-purchase.totalAmount} />
                  </TableCell>
                  <TableCell className="flex items-center justify-end gap-1">
                    <NewPurchaseDialog
                      cardId={cardId}
                      allTags={allTags}
                      purchase={purchase}
                      triggerLabel="Editar"
                      triggerVariant="ghost"
                      triggerSize="xs"
                    />
                    <Button
                      variant="ghost"
                      size="xs"
                      disabled={pending}
                      onClick={() => remove(purchase.id)}
                    >
                      Excluir
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
