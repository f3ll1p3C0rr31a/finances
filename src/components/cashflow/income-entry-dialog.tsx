"use client"

import { useState, useTransition } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import {
  incomeEntrySchema,
  type IncomeEntryFormValues,
  type IncomeEntryInput,
} from "@/lib/validation/schemas"
import { createIncomeEntry, updateIncomeEntry } from "@/lib/actions/income"
import { setIncomeEntryTags } from "@/lib/actions/tags"
import type { SerializedIncomeEntry } from "@/lib/types"
import type { TagOption } from "@/components/tags/tag-multi-select"
import { TagMultiSelect } from "@/components/tags/tag-multi-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Switch } from "@/components/ui/switch"
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

type Props = {
  month: string
  entry?: SerializedIncomeEntry
  triggerLabel: string
  triggerVariant?: "default" | "outline" | "ghost" | "secondary"
  triggerSize?: "default" | "sm" | "xs" | "icon-sm"
  allTags: TagOption[]
}

export function IncomeEntryDialog({
  month,
  entry,
  triggerLabel,
  triggerVariant = "default",
  triggerSize = "default",
  allTags,
}: Props) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [tagIds, setTagIds] = useState<string[]>(entry?.tags.map((t) => t.id) ?? [])

  const form = useForm<IncomeEntryFormValues, unknown, IncomeEntryInput>({
    resolver: zodResolver(incomeEntrySchema),
    defaultValues: {
      name: entry?.name ?? "",
      amount: entry?.amount ?? 0,
      dueDay: entry?.dueDay ?? undefined,
      dueDayType: entry?.dueDayType ?? "CALENDAR_DAY",
      recurring: entry?.isRecurring ?? false,
    },
  })

  const dueDayType = useWatch({ control: form.control, name: "dueDayType" })

  function onSubmit(values: IncomeEntryInput) {
    startTransition(async () => {
      try {
        const [year, monthIndex] = month.split("-").map(Number)
        const monthDate = new Date(Date.UTC(year, monthIndex - 1, 1))
        let entryId: string
        if (entry) {
          await updateIncomeEntry(entry.id, values)
          entryId = entry.id
        } else {
          entryId = (await createIncomeEntry(monthDate, values)).id
        }
        await setIncomeEntryTags(entryId, tagIds)
        toast.success("Entrada salva.")
        setOpen(false)
        form.reset()
      } catch {
        toast.error("Não foi possível salvar a entrada.")
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
          <DialogTitle>{entry ? "Editar entrada" : "Nova entrada"}</DialogTitle>
          <DialogDescription>
            Registre um recebimento recorrente (ex: salário) ou único.
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
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {dueDayType === "BUSINESS_DAY" ? "Nº do dia útil" : "Dia de recebimento"}
                    </FormLabel>
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
            </div>
            {!entry ? (
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
