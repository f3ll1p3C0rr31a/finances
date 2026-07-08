"use client"

import { useState, useTransition } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { cardSchema, type CardFormValues, type CardInput } from "@/lib/validation/cardSchemas"
import { createCard, updateCard } from "@/lib/actions/cards"
import { defaultBestPurchaseDay } from "@/lib/calculations/cardTiming"
import { currentMonth } from "@/lib/calculations/month"
import { CARD_BRAND_LABELS, detectCardBrand } from "@/lib/cardBrand"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CurrencyInput } from "@/components/ui/currency-input"
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
  DialogDescription,
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

function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 19)
  return digits.replace(/(.{4})/g, "$1 ").trim()
}

type Props = {
  card?: {
    id: string
    name: string
    accountId: string | null
    closingDay: number | null
    bestPurchaseDay: number | null
    paymentDay: number | null
    creditLimit: number | null
    cardNumber: string | null
    cvv: string | null
    expiryMonth: number | null
    expiryYear: number | null
  }
  accounts?: { id: string; name: string }[]
  triggerLabel?: string
  triggerVariant?: "default" | "outline" | "ghost" | "secondary"
  triggerSize?: "default" | "sm" | "xs" | "icon-sm"
}

export function NewCardDialog({
  card,
  accounts = [],
  triggerLabel,
  triggerVariant = "default",
  triggerSize = "default",
}: Props) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const form = useForm<CardFormValues, unknown, CardInput>({
    resolver: zodResolver(cardSchema),
    defaultValues: {
      name: card?.name ?? "",
      accountId: card?.accountId ?? null,
      closingDay: card?.closingDay ?? undefined,
      bestPurchaseDay: card?.bestPurchaseDay ?? undefined,
      paymentDay: card?.paymentDay ?? undefined,
      creditLimit: card?.creditLimit ?? undefined,
      cardNumber: card?.cardNumber ? formatCardNumber(card.cardNumber) : "",
      cvv: card?.cvv ?? "",
      expiryMonth: card?.expiryMonth ?? undefined,
      expiryYear: card?.expiryYear ?? undefined,
    },
  })
  const closingDay = useWatch({ control: form.control, name: "closingDay" })
  const bestPurchaseDay = useWatch({ control: form.control, name: "bestPurchaseDay" })
  const cardNumber = useWatch({ control: form.control, name: "cardNumber" })
  const automaticBestDay = defaultBestPurchaseDay(Number(closingDay) || null, currentMonth())
  const effectiveBestDay = Number(bestPurchaseDay) || automaticBestDay
  const detectedBrand = detectCardBrand(cardNumber ?? "")

  function onSubmit(values: CardInput) {
    startTransition(async () => {
      try {
        if (card) {
          await updateCard(card.id, values)
        } else {
          await createCard(values)
        }
        toast.success("Cartão salvo.")
        setOpen(false)
        form.reset()
      } catch {
        toast.error("Não foi possível salvar o cartão.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={triggerVariant} size={triggerSize} />}>
        {triggerLabel ?? (card ? "Editar cartão" : "Novo cartão")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{card ? "Editar cartão" : "Novo cartão"}</DialogTitle>
          <DialogDescription>
            Informe fechamento, vencimento e, se precisar, sobrescreva o melhor dia de compra.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="ex: Nubank" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="accountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Conta / banco vinculado (opcional)</FormLabel>
                  <Select value={field.value ?? "NONE"} onValueChange={(value) => field.onChange(value === "NONE" ? null : value)}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(value: string) =>
                            value === "NONE"
                              ? "Nenhuma"
                              : accounts.find((account) => account.id === value)?.name ?? "Nenhuma"
                          }
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="NONE">Nenhuma</SelectItem>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cardNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número do cartão (opcional)</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="0000 0000 0000 0000"
                      className="font-mono"
                      {...field}
                      value={String(field.value ?? "")}
                      onChange={(event) => field.onChange(formatCardNumber(event.target.value))}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    {detectedBrand !== "unknown"
                      ? `Bandeira detectada: ${CARD_BRAND_LABELS[detectedBrand]}.`
                      : "A bandeira é detectada automaticamente pelo número."}{" "}
                    Fica mascarado na tela; cada bloco pode ser copiado com um clique.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="cvv"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CVV</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="123"
                        maxLength={4}
                        className="font-mono"
                        {...field}
                        value={String(field.value ?? "")}
                        onChange={(event) =>
                          field.onChange(event.target.value.replace(/\D/g, "").slice(0, 4))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expiryMonth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Validade (mês)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={12}
                        placeholder="MM"
                        {...field}
                        value={String(field.value ?? "")}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expiryYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Validade (ano)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={2099}
                        placeholder="AA"
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
              name="closingDay"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dia de fechamento (opcional)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      {...field}
                      value={String(field.value ?? "")}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bestPurchaseDay"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Melhor dia de compra (opcional)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      placeholder={
                        automaticBestDay ? `Automático: dia ${automaticBestDay}` : "ex: 30"
                      }
                      {...field}
                      value={String(field.value ?? "")}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Vazio usa 1 dia antes do fechamento. Melhor dia atual:{" "}
                    {effectiveBestDay ? `dia ${effectiveBestDay}` : "não definido"}.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="paymentDay"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dia de pagamento da fatura (opcional)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      placeholder="ex: 10"
                      {...field}
                      value={String(field.value ?? "")}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="creditLimit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Limite de crédito (opcional)</FormLabel>
                  <FormControl>
                    <CurrencyInput
                      value={Number(field.value) || 0}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
