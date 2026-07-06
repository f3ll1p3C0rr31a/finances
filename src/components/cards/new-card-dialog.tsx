"use client"

import { useState, useTransition } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { cardSchema, type CardFormValues, type CardInput } from "@/lib/validation/cardSchemas"
import { createCard, updateCard } from "@/lib/actions/cards"
import { defaultBestPurchaseDay } from "@/lib/calculations/cardTiming"
import { currentMonth } from "@/lib/calculations/month"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CurrencyInput } from "@/components/ui/currency-input"
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

type Props = {
  card?: {
    id: string
    name: string
    closingDay: number | null
    bestPurchaseDay: number | null
    creditLimit: number | null
  }
  triggerLabel?: string
  triggerVariant?: "default" | "outline" | "ghost" | "secondary"
  triggerSize?: "default" | "sm" | "xs" | "icon-sm"
}

export function NewCardDialog({
  card,
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
      closingDay: card?.closingDay ?? undefined,
      bestPurchaseDay: card?.bestPurchaseDay ?? undefined,
      creditLimit: card?.creditLimit ?? undefined,
    },
  })
  const closingDay = useWatch({ control: form.control, name: "closingDay" })
  const bestPurchaseDay = useWatch({ control: form.control, name: "bestPurchaseDay" })
  const automaticBestDay = defaultBestPurchaseDay(Number(closingDay) || null, currentMonth())
  const effectiveBestDay = Number(bestPurchaseDay) || automaticBestDay

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
            Informe o fechamento e, se precisar, sobrescreva o melhor dia de compra.
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
