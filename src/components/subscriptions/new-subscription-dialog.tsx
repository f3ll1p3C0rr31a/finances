"use client"

import { useState, useTransition } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import {
  subscriptionSchema,
  type SubscriptionFormValues,
  type SubscriptionInput,
} from "@/lib/validation/subscriptionSchemas"
import { createSubscription, updateSubscription } from "@/lib/actions/subscriptions"
import { setSubscriptionTags } from "@/lib/actions/tags"
import type { SerializedSubscription } from "@/lib/types"
import type { TagOption } from "@/components/tags/tag-multi-select"
import { TagMultiSelect } from "@/components/tags/tag-multi-select"
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

const PAYMENT_METHOD_LABELS = {
  CASH: "Dinheiro",
  PIX: "Pix",
  TRANSFER: "Transferência",
  BOLETO: "Boleto",
  CARD: "Cartão",
  OTHER: "Outro",
} as const

type CardOption = { id: string; name: string }

export function NewSubscriptionDialog({
  cards,
  allTags,
  subscription,
  triggerLabel = "Nova assinatura",
  triggerVariant,
  triggerSize,
}: {
  cards: CardOption[]
  allTags: TagOption[]
  subscription?: SerializedSubscription
  triggerLabel?: string
  triggerVariant?: "default" | "ghost"
  triggerSize?: "default" | "xs"
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [tagIds, setTagIds] = useState<string[]>(subscription?.tags.map((tag) => tag.id) ?? [])
  const isEditing = Boolean(subscription)

  const form = useForm<SubscriptionFormValues, unknown, SubscriptionInput>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: {
      name: subscription?.name ?? "",
      amount:
        subscription?.currency === "USD"
          ? subscription.originalAmount ?? 0
          : subscription?.amount ?? 0,
      currency: subscription?.currency ?? "BRL",
      exchangeRate: subscription?.exchangeRate ?? null,
      paymentMethod: subscription?.paymentMethod ?? "CASH",
      cardId: subscription?.cardId ?? null,
    },
  })

  const paymentMethod = useWatch({ control: form.control, name: "paymentMethod" })
  const currency = useWatch({ control: form.control, name: "currency" })

  function resetForm() {
    setTagIds(subscription?.tags.map((tag) => tag.id) ?? [])
    form.reset({
      name: subscription?.name ?? "",
      amount:
        subscription?.currency === "USD"
          ? subscription.originalAmount ?? 0
          : subscription?.amount ?? 0,
      currency: subscription?.currency ?? "BRL",
      exchangeRate: subscription?.exchangeRate ?? null,
      paymentMethod: subscription?.paymentMethod ?? "CASH",
      cardId: subscription?.cardId ?? null,
    })
  }

  function onSubmit(values: SubscriptionInput) {
    startTransition(async () => {
      try {
        const subscriptionId = subscription
          ? subscription.id
          : (await createSubscription(values)).id
        if (subscription) {
          await updateSubscription(subscription.id, values)
        }
        await setSubscriptionTags(subscriptionId, tagIds)
        toast.success(subscription ? "Assinatura atualizada." : "Assinatura criada.")
        setOpen(false)
        if (!subscription) {
          setTagIds([])
          form.reset({
            name: "",
            amount: 0,
            currency: "BRL",
            exchangeRate: null,
            paymentMethod: "CASH",
            cardId: null,
          })
        }
      } catch {
        toast.error("Não foi possível salvar a assinatura.")
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) resetForm()
      }}
    >
      <DialogTrigger render={<Button variant={triggerVariant} size={triggerSize} />}>
        {triggerLabel}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar assinatura" : "Nova assinatura"}</DialogTitle>
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
                    <Input {...field} placeholder="ex: Netflix" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Moeda</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(value: string) => (value === "USD" ? "Dólar (USD)" : "Real (BRL)")}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="BRL">Real (BRL)</SelectItem>
                        <SelectItem value="USD">Dólar (USD)</SelectItem>
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
                    <FormLabel>{currency === "USD" ? "Valor mensal em US$" : "Valor mensal"}</FormLabel>
                    <FormControl>
                      <CurrencyInput
                        value={Number(field.value) || 0}
                        onChange={field.onChange}
                        currency={currency}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {currency === "USD" ? (
              <FormField
                control={form.control}
                name="exchangeRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cotação média do mês</FormLabel>
                    <FormControl>
                      <CurrencyInput value={Number(field.value) || 0} onChange={field.onChange} />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Usada para converter esta assinatura para reais no planejamento.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
            <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Forma de pagamento</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(value: string) =>
                              PAYMENT_METHOD_LABELS[value as keyof typeof PAYMENT_METHOD_LABELS]
                            }
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {paymentMethod === "CARD" ? (
              <FormField
                control={form.control}
                name="cardId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cartão</FormLabel>
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(value: string) =>
                              cards.find((c) => c.id === value)?.name ?? "Selecione"
                            }
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {cards.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
