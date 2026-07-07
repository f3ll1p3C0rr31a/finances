"use client"

import { useTransition } from "react"
import { toast } from "sonner"

import {
  cancelSubscription,
  reactivateSubscription,
  deleteSubscription,
} from "@/lib/actions/subscriptions"
import { formatMonthLabel } from "@/lib/calculations/month"
import { formatCurrency } from "@/lib/calculations/format"
import type { SerializedSubscription } from "@/lib/types"
import type { TagOption } from "@/components/tags/tag-multi-select"
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
import { SubscriptionTagsDialog } from "@/components/subscriptions/subscription-tags-dialog"

const PAYMENT_METHOD_LABELS = {
  CASH: "Dinheiro",
  PIX: "Pix",
  TRANSFER: "Transferência",
  BOLETO: "Boleto",
  CARD: "Cartão",
  OTHER: "Outro",
} as const

type CardOption = { id: string; name: string }

export function SubscriptionList({
  subscriptions,
  allTags,
}: {
  subscriptions: SerializedSubscription[]
  cards: CardOption[]
  allTags: TagOption[]
}) {
  const [pending, startTransition] = useTransition()

  function cancel(id: string) {
    startTransition(async () => {
      try {
        await cancelSubscription(id)
        toast.success("Assinatura cancelada.")
      } catch {
        toast.error("Não foi possível cancelar.")
      }
    })
  }

  function reactivate(id: string) {
    startTransition(async () => {
      try {
        await reactivateSubscription(id)
        toast.success("Assinatura reativada.")
      } catch {
        toast.error("Não foi possível reativar.")
      }
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      try {
        await deleteSubscription(id)
        toast.success("Assinatura removida.")
      } catch {
        toast.error("Não foi possível remover.")
      }
    })
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Valor</TableHead>
          <TableHead>Forma de pagamento</TableHead>
          <TableHead>Etiquetas</TableHead>
          <TableHead>Desde</TableHead>
          <TableHead className="w-0" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {subscriptions.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground">
              Nenhuma assinatura por aqui.
            </TableCell>
          </TableRow>
        ) : (
          subscriptions.map((sub) => (
            <TableRow key={sub.id}>
              <TableCell className="font-medium">{sub.name}</TableCell>
              <TableCell>{formatCurrency(sub.amount)}</TableCell>
              <TableCell>
                {PAYMENT_METHOD_LABELS[sub.paymentMethod]}
                {sub.cardName ? ` (${sub.cardName})` : ""}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-1">
                  {sub.tags.map((tag) => (
                    <Badge key={tag.id} variant="secondary">
                      {tag.name}
                    </Badge>
                  ))}
                  <SubscriptionTagsDialog
                    subscriptionId={sub.id}
                    currentTagIds={sub.tags.map((tag) => tag.id)}
                    allTags={allTags}
                  />
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatMonthLabel(new Date(sub.startMonth))}
              </TableCell>
              <TableCell className="flex justify-end gap-2">
                {sub.active ? (
                  <>
                    <Button variant="ghost" size="xs" disabled={pending} onClick={() => cancel(sub.id)}>
                      Cancelar
                    </Button>
                    <Button variant="ghost" size="xs" disabled={pending} onClick={() => remove(sub.id)}>
                      Excluir
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" size="xs" disabled={pending} onClick={() => reactivate(sub.id)}>
                      Reativar
                    </Button>
                    <Button variant="ghost" size="xs" disabled={pending} onClick={() => remove(sub.id)}>
                      Excluir
                    </Button>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
