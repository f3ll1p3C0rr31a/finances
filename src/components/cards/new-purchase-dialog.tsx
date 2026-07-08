"use client"

import { useState, useTransition } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import {
  cardPurchaseSchema,
  type CardPurchaseFormValues,
  type CardPurchaseInput,
} from "@/lib/validation/cardSchemas"
import { createCardPurchase, updateCardPurchase } from "@/lib/actions/cards"
import { setCardPurchaseTags } from "@/lib/actions/tags"
import { addMonths, formatMonthLabel } from "@/lib/calculations/month"
import { invoiceMonthForPurchase } from "@/lib/calculations/cardTiming"
import { formatCurrency } from "@/lib/calculations/format"
import type { SerializedCardPurchase } from "@/lib/types"
import type { TagOption } from "@/components/tags/tag-multi-select"
import { TagMultiSelect } from "@/components/tags/tag-multi-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

const AMOUNT_MODE_LABELS = {
  INSTALLMENT: "Valor da parcela",
  TOTAL: "Valor total da compra",
} as const

type Props = {
  cardId: string
  allTags: TagOption[]
  purchase?: SerializedCardPurchase
  triggerLabel?: string
  triggerVariant?: "default" | "outline" | "ghost" | "secondary"
  triggerSize?: "default" | "sm" | "xs" | "icon-sm"
  cardCycle?: { closingDay: number | null; paymentDay: number | null }
}

export function NewPurchaseDialog({
  cardId,
  allTags,
  purchase,
  triggerLabel,
  triggerVariant = "default",
  triggerSize = "default",
  cardCycle,
}: Props) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [tagIds, setTagIds] = useState<string[]>(purchase?.tags.map((t) => t.id) ?? [])

  const form = useForm<CardPurchaseFormValues, unknown, CardPurchaseInput>({
    resolver: zodResolver(cardPurchaseSchema),
    defaultValues: {
      description: purchase?.description ?? "",
      amount: purchase?.installmentAmount ?? 0,
      amountMode: "INSTALLMENT",
      purchaseDate: purchase ? purchase.purchaseDate.slice(0, 10) : todayIsoDate(),
      installmentCount: purchase?.installmentCount ?? 1,
      hasInterest: purchase?.hasInterest ?? false,
    },
  })

  const amount = Number(useWatch({ control: form.control, name: "amount" })) || 0
  const amountMode = useWatch({ control: form.control, name: "amountMode" })
  const installmentCount = Number(useWatch({ control: form.control, name: "installmentCount" })) || 1
  const purchaseDateStr = useWatch({ control: form.control, name: "purchaseDate" })

  const perInstallment = amountMode === "INSTALLMENT" ? amount : amount / installmentCount
  const total = amountMode === "INSTALLMENT" ? amount * installmentCount : amount

  let rangeLabel: string | null = null
  if (purchaseDateStr && installmentCount > 0) {
    const [y, m, d] = purchaseDateStr.split("-").map(Number)
    if (y && m && d) {
      const purchaseDate = new Date(Date.UTC(y, m - 1, d))
      const startMonth = invoiceMonthForPurchase(
        { closingDay: cardCycle?.closingDay ?? null, paymentDay: cardCycle?.paymentDay ?? null },
        purchaseDate
      )
      const endMonth = addMonths(startMonth, installmentCount - 1)
      rangeLabel =
        installmentCount > 1
          ? `${formatMonthLabel(startMonth)} até ${formatMonthLabel(endMonth)}`
          : formatMonthLabel(startMonth)
    }
  }

  function onSubmit(values: CardPurchaseInput) {
    startTransition(async () => {
      try {
        let id: string
        if (purchase) {
          await updateCardPurchase(purchase.id, values)
          id = purchase.id
        } else {
          id = (await createCardPurchase(cardId, values)).id
        }
        await setCardPurchaseTags(id, tagIds)
        toast.success("Compra salva.")
        setOpen(false)
        if (!purchase) {
          setTagIds([])
          form.reset({
            description: "",
            amount: 0,
            amountMode: "INSTALLMENT",
            purchaseDate: todayIsoDate(),
            installmentCount: 1,
            hasInterest: false,
          })
        }
      } catch {
        toast.error("Não foi possível salvar a compra.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant={triggerVariant} size={triggerSize} />}
      >
        {triggerLabel ?? (purchase ? "Editar" : "Nova compra")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{purchase ? "Editar compra" : "Nova compra"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="amountMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>O valor digitado é</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(value: string) =>
                              AMOUNT_MODE_LABELS[value as keyof typeof AMOUNT_MODE_LABELS]
                            }
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="INSTALLMENT">Valor da parcela</SelectItem>
                        <SelectItem value="TOTAL">Valor total</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor</FormLabel>
                    <FormControl>
                      <CurrencyInput value={Number(field.value) || 0} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="purchaseDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data da compra</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="installmentCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parcelas (1 = à vista)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={48}
                        {...field}
                        value={String(field.value ?? "")}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="hasInterest"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <FormLabel>Comprado com juros</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            {amount > 0 ? (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <p>
                  Parcela: <strong>{formatCurrency(perInstallment)}</strong>
                  {installmentCount > 1 ? ` × ${installmentCount}` : ""} — Total:{" "}
                  <strong>{formatCurrency(total)}</strong>
                </p>
                {rangeLabel ? (
                  <p className="text-muted-foreground">
                    Cobrança em: {rangeLabel}
                    {cardCycle?.paymentDay ? ` · vencimento dia ${cardCycle.paymentDay}` : ""}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="grid gap-2">
              <FormLabel>Etiquetas</FormLabel>
              <TagMultiSelect allTags={allTags} selectedIds={tagIds} onChange={setTagIds} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
