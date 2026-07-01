"use client"

import { useState, useTransition } from "react"
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

export function PurchaseList({
  purchases,
  allTags,
}: {
  purchases: SerializedCardPurchase[]
  allTags: TagOption[]
}) {
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useState<string[]>([])
  const [bulkTagIds, setBulkTagIds] = useState<string[]>([])

  function toggleSelect(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-0" />
            <TableHead>Descrição</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Etiquetas</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="w-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {purchases.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Nenhuma compra registrada.
              </TableCell>
            </TableRow>
          ) : (
            purchases.map((purchase) => (
              <TableRow key={purchase.id}>
                <TableCell>
                  <Checkbox
                    checked={selected.includes(purchase.id)}
                    onCheckedChange={() => toggleSelect(purchase.id)}
                  />
                </TableCell>
                <TableCell className="font-medium">
                  {purchase.description}{" "}
                  {purchase.installmentCount > 1 ? (
                    <Badge variant="secondary">{purchase.installmentCount}x</Badge>
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
                <TableCell className="text-right">
                  <MoneyText value={-purchase.totalAmount} />
                </TableCell>
                <TableCell className="text-right">
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
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
