"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import {
  cardPurchaseSchema,
  type CardPurchaseFormValues,
  type CardPurchaseInput,
} from "@/lib/validation/cardSchemas"
import { createCardPurchase } from "@/lib/actions/cards"
import { setCardPurchaseTags } from "@/lib/actions/tags"
import type { TagOption } from "@/components/tags/tag-multi-select"
import { TagMultiSelect } from "@/components/tags/tag-multi-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CurrencyInput } from "@/components/ui/currency-input"
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

export function NewPurchaseDialog({
  cardId,
  allTags,
}: {
  cardId: string
  allTags: TagOption[]
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [tagIds, setTagIds] = useState<string[]>([])

  const form = useForm<CardPurchaseFormValues, unknown, CardPurchaseInput>({
    resolver: zodResolver(cardPurchaseSchema),
    defaultValues: {
      description: "",
      totalAmount: 0,
      purchaseDate: todayIsoDate(),
      installmentCount: 1,
    },
  })

  function onSubmit(values: CardPurchaseInput) {
    startTransition(async () => {
      try {
        const { id } = await createCardPurchase(cardId, values)
        await setCardPurchaseTags(id, tagIds)
        toast.success("Compra registrada.")
        setOpen(false)
        setTagIds([])
        form.reset({
          description: "",
          totalAmount: 0,
          purchaseDate: todayIsoDate(),
          installmentCount: 1,
        })
      } catch {
        toast.error("Não foi possível registrar a compra.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>Nova compra</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova compra</DialogTitle>
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
            <FormField
              control={form.control}
              name="totalAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor total</FormLabel>
                  <FormControl>
                    <CurrencyInput value={Number(field.value) || 0} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
