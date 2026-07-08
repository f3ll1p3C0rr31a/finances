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
import { NewSubscriptionDialog } from "@/components/subscriptions/new-subscription-dialog"
import { SubscriptionLogo } from "@/components/brand/subscription-logo"
import { PixIcon } from "@/components/brand/pix-icon"

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
  cards,
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
          <TableHead>Cobra dia</TableHead>
          <TableHead>Forma de pagamento</TableHead>
          <TableHead>Etiquetas</TableHead>
          <TableHead>Desde</TableHead>
          <TableHead className="w-0" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {subscriptions.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-muted-foreground">
              Nenhuma assinatura por aqui.
            </TableCell>
          </TableRow>
        ) : (
          subscriptions.map((sub) => (
            <TableRow key={sub.id}>
              <TableCell className="font-medium">
                <span className="inline-flex items-center gap-2">
                  <SubscriptionLogo name={sub.name} logoDomain={sub.logoDomain} />
                  {sub.name}
                </span>
              </TableCell>
              <TableCell>
                {formatCurrency(sub.amount)}
                {sub.currency === "USD" && sub.originalAmount && sub.exchangeRate ? (
                  <span className="block text-xs text-muted-foreground">
                    US$ {sub.originalAmount.toFixed(2)} × {sub.exchangeRate.toFixed(4)}
                  </span>
                ) : null}
              </TableCell>
              <TableCell>Dia {sub.chargeDay}</TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1.5">
                  {sub.paymentMethod === "PIX" ? <PixIcon /> : null}
                  {PAYMENT_METHOD_LABELS[sub.paymentMethod]}
                  {sub.cardName ? ` (${sub.cardName})` : ""}
                </span>
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
                {sub.cancelledAt ? (
                  <span className="block text-xs text-destructive">
                    Cancelada em{" "}
                    {new Date(sub.cancelledAt).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="flex justify-end gap-2">
                {sub.active ? (
                  <>
                    <NewSubscriptionDialog
                      cards={cards}
                      allTags={allTags}
                      subscription={sub}
                      triggerLabel="Editar"
                      triggerVariant="ghost"
                      triggerSize="xs"
                    />
                    <Button variant="ghost" size="xs" disabled={pending} onClick={() => cancel(sub.id)}>
                      Cancelar
                    </Button>
                    <Button variant="ghost" size="xs" disabled={pending} onClick={() => remove(sub.id)}>
                      Excluir
                    </Button>
                  </>
                ) : (
                  <>
                    <NewSubscriptionDialog
                      cards={cards}
                      allTags={allTags}
                      subscription={sub}
                      triggerLabel="Editar"
                      triggerVariant="ghost"
                      triggerSize="xs"
                    />
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
