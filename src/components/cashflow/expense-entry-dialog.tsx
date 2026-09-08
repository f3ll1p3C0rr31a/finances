"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { ptBR } from "date-fns/locale"
import { CalendarDays, FileText } from "lucide-react"

import {
  expenseEntrySchema,
  type ExpenseEntryFormValues,
  type ExpenseEntryInput,
} from "@/lib/validation/schemas"
import {
  createExpenseEntry,
  removeExpenseAttachment,
  updateExpenseEntry,
  uploadExpenseAttachment,
} from "@/lib/actions/expense"
import { setExpenseEntryTags } from "@/lib/actions/tags"
import type { SerializedExpenseEntry } from "@/lib/types"
import type { TagOption } from "@/components/tags/tag-multi-select"
import { TagMultiSelect } from "@/components/tags/tag-multi-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Switch } from "@/components/ui/switch"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { isBusinessDay, resolveDueDate } from "@/lib/calculations/businessDay"
import { addMonths, formatMonthLabel } from "@/lib/calculations/month"
import { formatCurrency } from "@/lib/calculations/format"
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
  BOLETO: "Boleto",
  CARD: "Cartão",
  OTHER: "Outro",
} as const

const AMOUNT_MODE_LABELS = {
  INSTALLMENT: "Valor da parcela",
  TOTAL: "Valor total da dívida",
} as const

const MAX_INSTALLMENTS = 48

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
  const [splitInInstallments, setSplitInInstallments] = useState(false)
  const [boletoFile, setBoletoFile] = useState<File | null>(null)
  // Bumped after a save so the file input remounts empty.
  const [fileInputKey, setFileInputKey] = useState(0)
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
      uncertain: entry?.uncertain ?? false,
      paidBy: entry?.paidBy ?? "SELF",
      paidByName: entry?.paidByName ?? "",
      paymentMethod: entry?.paymentMethod ?? "PIX",
      pixKeyId: entry?.pixKeyId ?? null,
      externalLink: entry?.externalLink ?? "",
      boletoNumber: entry?.boletoNumber ?? "",
      installmentCount: 1,
      amountMode: "TOTAL",
    },
  })

  const category = useWatch({ control: form.control, name: "category" })
  const uncertain = useWatch({ control: form.control, name: "uncertain" })
  const paidBy = useWatch({ control: form.control, name: "paidBy" })
  const dueDayType = useWatch({ control: form.control, name: "dueDayType" })
  const paymentMethod = useWatch({ control: form.control, name: "paymentMethod" })
  const amount = Number(useWatch({ control: form.control, name: "amount" })) || 0
  const amountMode = useWatch({ control: form.control, name: "amountMode" })
  const installmentCount =
    Number(useWatch({ control: form.control, name: "installmentCount" })) || 1
  const recurring = useWatch({ control: form.control, name: "recurring" })

  // Recurrence has no end and an uncertain expense has no schedule, so neither
  // can be split into a fixed plan.
  const canSplit = !entry && !uncertain && !recurring
  const splitting = canSplit && splitInInstallments && installmentCount > 1
  const perInstallment = amountMode === "INSTALLMENT" ? amount : amount / installmentCount
  const total = amountMode === "INSTALLMENT" ? amount * installmentCount : amount
  const lastMonth = addMonths(monthDate, installmentCount - 1)

  function resetInstallments() {
    setSplitInInstallments(false)
    form.setValue("installmentCount", 1)
    form.setValue("amountMode", "TOTAL")
  }

  function onSubmit(values: ExpenseEntryInput) {
    const payload: ExpenseEntryInput = splitting
      ? values
      : { ...values, installmentCount: 1, amountMode: "TOTAL" }

    startTransition(async () => {
      try {
        let entryId: string
        if (entry) {
          await updateExpenseEntry(entry.id, payload)
          entryId = entry.id
        } else {
          // For a plan this is the first installment, where the boleto of the
          // first payment belongs; the others are attached from their own row.
          entryId = (await createExpenseEntry(monthDate, payload)).id
        }
        await setExpenseEntryTags(entryId, tagIds)

        if (boletoFile) {
          const formData = new FormData()
          formData.set("file", boletoFile)
          await uploadExpenseAttachment(entryId, formData)
        }

        toast.success(
          splitting
            ? `Despesa parcelada em ${installmentCount}x.`
            : "Despesa salva."
        )
        setOpen(false)
        setBoletoFile(null)
        setFileInputKey((key) => key + 1)
        if (!entry) {
          setTagIds([])
          resetInstallments()
        }
        form.reset()
      } catch {
        toast.error("Não foi possível salvar a despesa.")
      }
    })
  }

  function detachBoleto() {
    if (!entry) return
    startTransition(async () => {
      try {
        await removeExpenseAttachment(entry.id)
        toast.success("PDF removido.")
      } catch {
        toast.error("Não foi possível remover o PDF.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={triggerVariant} size={triggerSize} />}>
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{entry ? "Editar despesa" : "Nova despesa"}</DialogTitle>
          <DialogDescription>
            Registre uma conta recorrente (ex: aluguel) ou avulsa.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            {entry?.installment ? (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <p>
                  Parcela <strong>
                    {entry.installment.number}/{entry.installment.count}
                  </strong>{" "}
                  de {formatCurrency(entry.installment.totalAmount)}.
                </p>
                <p className="text-muted-foreground">
                  Alterar o valor aqui muda apenas esta parcela. O nome e a categoria valem
                  para todas as parcelas.
                </p>
              </div>
            ) : null}
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
                  <FormLabel>
                    {splitting ? AMOUNT_MODE_LABELS[amountMode] : "Valor"}
                  </FormLabel>
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
            {!entry?.isRecurring ? (
              <FormField
                control={form.control}
                name="uncertain"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between gap-4 rounded-lg border p-3">
                    <div>
                      <FormLabel>Pagamento incerto</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Não entra no total até ser pago e avança para o próximo mês.
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          field.onChange(checked)
                          if (checked) {
                            form.setValue("recurring", false)
                            form.setValue("dueDay", null)
                            resetInstallments()
                          }
                        }}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            ) : null}
            {!uncertain ? (
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
            ) : null}
            {!entry && !uncertain && category !== "ONE_OFF" && !splitInInstallments ? (
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
            {canSplit ? (
              <div className="grid gap-3 rounded-lg border p-3">
                <div className="flex flex-row items-center justify-between gap-4">
                  <div>
                    <Label>Parcelar o pagamento</Label>
                    <p className="text-xs text-muted-foreground">
                      Divide a dívida em parcelas mensais, uma despesa por mês.
                    </p>
                  </div>
                  <Switch
                    checked={splitInInstallments}
                    onCheckedChange={(checked) => {
                      setSplitInInstallments(checked)
                      if (checked) {
                        form.setValue("recurring", false)
                        form.setValue("installmentCount", 2)
                      } else {
                        form.setValue("installmentCount", 1)
                        form.setValue("amountMode", "TOTAL")
                      }
                    }}
                  />
                </div>
                {splitInInstallments ? (
                  <>
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
                                <SelectItem value="TOTAL">Valor total da dívida</SelectItem>
                                <SelectItem value="INSTALLMENT">Valor da parcela</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="installmentCount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Parcelas</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={2}
                                max={MAX_INSTALLMENTS}
                                {...field}
                                value={String(field.value ?? "")}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    {amount > 0 && installmentCount > 1 ? (
                      <div className="rounded-lg bg-muted/30 p-3 text-sm">
                        <p>
                          <strong>{installmentCount}x</strong> de{" "}
                          <strong>{formatCurrency(perInstallment)}</strong> — Total:{" "}
                          <strong>{formatCurrency(total)}</strong>
                        </p>
                        <p className="text-muted-foreground">
                          De {formatMonthLabel(monthDate)} até {formatMonthLabel(lastMonth)}
                        </p>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
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
              name="externalLink"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Link externo (opcional)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="ex: portal onde gera o boleto"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {paymentMethod === "BOLETO" ? (
              <div className="grid gap-3 rounded-lg border p-3">
                <FormField
                  control={form.control}
                  name="boletoNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número do boleto (opcional)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          inputMode="numeric"
                          placeholder="Linha digitável, com ou sem pontos"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid gap-2">
                  <Label>PDF do boleto (opcional)</Label>
                  {entry?.hasAttachment ? (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-muted-foreground">{entry.attachmentFileName}</span>
                      <Button
                        variant="outline"
                        size="xs"
                        render={
                          <Link href={`/api/expense-attachments/${entry.id}`} target="_blank" />
                        }
                      >
                        <FileText />
                        Abrir
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        disabled={pending}
                        onClick={detachBoleto}
                      >
                        Remover
                      </Button>
                    </div>
                  ) : null}
                  <Input
                    key={fileInputKey}
                    type="file"
                    accept="application/pdf"
                    onChange={(event) => setBoletoFile(event.target.files?.[0] ?? null)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {splitting
                      ? "O PDF é anexado à 1ª parcela; anexe os demais pela linha de cada mês."
                      : entry?.hasAttachment
                        ? "Escolher um novo PDF substitui o anexo atual."
                        : "Até 10 MB."}
                  </p>
                </div>
              </div>
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
