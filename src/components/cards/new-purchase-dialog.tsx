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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

export function NewPurchaseDialog({ cardId }: { cardId: string }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

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
        await createCardPurchase(cardId, values)
        toast.success("Compra registrada.")
        setOpen(false)
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
                    <Input
                      type="number"
                      step="0.01"
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
