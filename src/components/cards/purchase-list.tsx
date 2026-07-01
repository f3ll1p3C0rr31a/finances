"use client"

import { useTransition } from "react"
import { toast } from "sonner"

import type { SerializedCardPurchase } from "@/lib/types"
import { deleteCardPurchase } from "@/lib/actions/cards"
import { formatCurrency } from "@/lib/calculations/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function PurchaseList({ purchases }: { purchases: SerializedCardPurchase[] }) {
  const [pending, startTransition] = useTransition()

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

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Descrição</TableHead>
          <TableHead>Data</TableHead>
          <TableHead className="text-right">Valor</TableHead>
          <TableHead className="w-0" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {purchases.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-muted-foreground">
              Nenhuma compra registrada.
            </TableCell>
          </TableRow>
        ) : (
          purchases.map((purchase) => (
            <TableRow key={purchase.id}>
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
              <TableCell className="text-right">{formatCurrency(purchase.totalAmount)}</TableCell>
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
  )
}
