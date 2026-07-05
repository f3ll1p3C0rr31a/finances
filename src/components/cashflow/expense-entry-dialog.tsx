"use client"

import { useState, useTransition } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { ptBR } from "date-fns/locale"
import { CalendarDays } from "lucide-react"

import {
  expenseEntrySchema,
  type ExpenseEntryFormValues,
  type ExpenseEntryInput,
} from "@/lib/validation/schemas"
import { createExpenseEntry, updateExpenseEntry } from "@/lib/actions/expense"
import { setExpenseEntryTags } from "@/lib/actions/tags"
import type { SerializedExpenseEntry } from "@/lib/types"
import type { TagOption } from "@/components/tags/tag-multi-select"
import { TagMultiSelect } from "@/components/tags/tag-multi-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Switch } from "@/components/ui/switch"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { isBusinessDay, resolveDueDate } from "@/lib/calculations/businessDay"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"

const CATEGORY_LABELS = {
  FIXED: "Fixa",
  VARIABLE: "Variável",
  ONE_OFF: "Avulsa",
} as const

const PAYMENT_METHOD_LABELS = {
  CASH: "Dinheiro",
  PIX: "Pix",
  TRANSFER: "Transferência",
  CARD: "Cartão",
  OTHER: "Outro",
} as const

type PixKeyOption = { id: string; label: string }

type Props = {
  month: string
  entry?: SerializedExpenseEntry
  triggerLabel: string
  triggerVariant?: "default" | "outline" | "ghost" | "secondary"
  triggerSize?: "default" | "sm" | "xs" | "icon-sm"
  allTags: TagOption[]
  pixPayees: PixKeyOption[]
}

function toLocalDate(date: Date): Date {
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

function toUtcDate(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
}

function businessDayOrdinal(date: Date): number {
  const utcDate = toUtcDate(date)
  let ordinal = 0

  for (let day = 1; day <= utcDate.getUTCDate(); day++) {
    const candidate = new Date(
      Date.UTC(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), day)
    )
    if (isBusinessDay(candidate)) ordinal++
  }

  return ordinal
}

export function ExpenseEntryDialog({
  month,
  entry,
  triggerLabel,
  triggerVariant = "default",
  triggerSize = "default",
  allTags,
  pixPayees,
}: Props) {
  const [open, setOpen] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [tagIds, setTagIds] = useState<string[]>(entry?.tags.map((t) => t.id) ?? [])
  const [year, monthIndex] = month.split("-").map(Number)
  const monthDate = new Date(Date.UTC(year, monthIndex - 1, 1))
  const localMonth = toLocalDate(monthDate)

  const form = useForm<ExpenseEntryFormValues, unknown, ExpenseEntryInput>({
    resolver: zodResolver(expenseEntrySchema),
    defaultValues: {
      name: entry?.name ?? "",
      amount: entry?.amount ?? 0,
      dueDay: entry?.dueDay ?? undefined,
      dueDayType: entry?.dueDayType ?? "CALENDAR_DAY",
      category: entry?.category ?? "FIXED",
      recurring: entry?.isRecurring ?? false,
      paidBy: entry?.paidBy ?? "SELF",
      paidByName: entry?.paidByName ?? "",
      paymentMethod: entry?.paymentMethod ?? "PIX",
      pixKeyId: entry?.pixKeyId ?? null,
    },
  })

  const category = useWatch({ control: form.control, name: "category" })
  const paidBy = useWatch({ control: form.control, name: "paidBy" })
  const dueDayType = useWatch({ control: form.control, name: "dueDayType" })
  const paymentMethod = useWatch({ control: form.control, name: "paymentMethod" })

  function onSubmit(values: ExpenseEntryInput) {
    startTransition(async () => {
      try {
        let entryId: string
        if (entry) {
          await updateExpenseEntry(entry.id, values)
          entryId = entry.id
        } else {
          entryId = (await createExpenseEntry(monthDate, values)).id
        }
        await setExpenseEntryTags(entryId, tagIds)
        toast.success("Despesa salva.")
        setOpen(false)
        form.reset()
      } catch {
        toast.error("Não foi possível salvar a despesa.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={triggerVariant} size={triggerSize} />}>
        {triggerLabel}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{entry ? "Editar despesa" : "Nova despesa"}</DialogTitle>
          <DialogDescription>
            Registre uma conta recorrente (ex: aluguel) ou avulsa.
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
                    <Input {...field} />
                  </FormControl>
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
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(value: string) =>
                            CATEGORY_LABELS[value as keyof typeof CATEGORY_LABELS]
                          }
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
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
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="dueDayType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de dia</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(value: string) =>
                              value === "BUSINESS_DAY" ? "Dia útil" : "Dia do mês"
                            }
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="CALENDAR_DAY">Dia do mês</SelectItem>
                        <SelectItem value="BUSINESS_DAY">Dia útil</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dueDay"
                render={({ field }) => {
                  const selectedDate = field.value
                    ? toLocalDate(
                        resolveDueDate(monthDate, dueDayType, Number(field.value))
                      )
                    : undefined

                  return (
                    <FormItem>
                      <FormLabel>Data de pagamento</FormLabel>
                      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                        <PopoverTrigger
                          render={
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full justify-start font-normal"
                            />
                          }
                        >
                          <CalendarDays />
                          {selectedDate
                            ? new Intl.DateTimeFormat("pt-BR").format(selectedDate)
                            : "Selecionar data"}
                        </PopoverTrigger>
                        <PopoverContent align="end" className="p-0">
                          <Calendar
                            mode="single"
                            locale={ptBR}
                            month={localMonth}
                            startMonth={localMonth}
                            endMonth={localMonth}
                            selected={selectedDate}
                            disabled={(date) => {
                              const outsideMonth =
                                date.getFullYear() !== localMonth.getFullYear() ||
                                date.getMonth() !== localMonth.getMonth()
                              return (
                                outsideMonth ||
                                (dueDayType === "BUSINESS_DAY" &&
                                  !isBusinessDay(toUtcDate(date)))
                              )
                            }}
                            onSelect={(date) => {
                              if (!date) return
                              field.onChange(
                                dueDayType === "BUSINESS_DAY"
                                  ? businessDayOrdinal(date)
                                  : date.getDate()
                              )
                              setCalendarOpen(false)
                            }}
                          />
                          <div className="border-t p-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="w-full"
                              onClick={() => {
                                field.onChange(null)
                                setCalendarOpen(false)
                              }}
                            >
                              Sem data de pagamento
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )
                }}
              />
            </div>
            {!entry && category !== "ONE_OFF" ? (
              <FormField
                control={form.control}
                name="recurring"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <FormLabel>Recorrente (todo mês)</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
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
            {paymentMethod === "PIX" ? (
              <FormField
                control={form.control}
                name="pixKeyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pagar para (chave Pix, opcional)</FormLabel>
                    <Select
                      value={field.value ?? "none"}
                      onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {() =>
                              pixPayees.find((p) => p.id === field.value)?.label ?? "Nenhuma"
                            }
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {pixPayees.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
            <FormField
              control={form.control}
              name="paidBy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pago por</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(value: string) => (value === "SELF" ? "Eu" : "Terceiro")}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="SELF">Eu</SelectItem>
                      <SelectItem value="THIRD_PARTY">Terceiro</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {paidBy === "THIRD_PARTY" ? (
              <FormField
                control={form.control}
                name="paidByName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome de quem paga</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} placeholder="ex: Fátima" />
                    </FormControl>
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
