"use client"

import { useTransition } from "react"
import { toast } from "sonner"

import type { SerializedIncomeEntry } from "@/lib/types"
import type { RecurrenceScope } from "@/lib/validation/schemas"
import type { TagOption } from "@/components/tags/tag-multi-select"
import { setIncomeReceived, deleteIncomeEntry } from "@/lib/actions/income"
import { formatDueDay, UNCERTAIN_BADGE_CLASS } from "@/lib/calculations/format"
import { MoneyText } from "@/components/ui/money-text"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { IncomeEntryDialog } from "@/components/cashflow/income-entry-dialog"
import { DeleteEntryButton } from "@/components/cashflow/delete-entry-button"

export function IncomeTable({
  month,
  entries,
  allTags,
}: {
  month: string
  entries: SerializedIncomeEntry[]
  allTags: TagOption[]
}) {
  const [pending, startTransition] = useTransition()

  function toggleReceived(id: string, received: boolean) {
    startTransition(async () => {
      try {
        await setIncomeReceived(id, received)
      } catch {
        toast.error("Não foi possível atualizar.")
      }
    })
  }

  function remove(id: string, scope: RecurrenceScope) {
    startTransition(async () => {
      try {
        const result = await deleteIncomeEntry(id, scope)
        if (result.recurring && result.scope === "THIS_AND_FUTURE") {
          toast.success(`Recorrência encerrada (${result.deletedEntries} meses removidos).`)
        } else {
          toast.success("Entrada removida.")
        }
      } catch {
        toast.error("Não foi possível remover.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Entradas</h2>
        <IncomeEntryDialog month={month} triggerLabel="Nova entrada" triggerSize="sm" allTags={allTags} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Dia</TableHead>
            <TableHead>Etiquetas</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="text-center">Recebido</TableHead>
            <TableHead className="w-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Nenhuma entrada neste mês.
              </TableCell>
            </TableRow>
          ) : (
            entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-medium">
                  <div className="flex flex-wrap items-center gap-2">
                    {entry.name}
                    {entry.uncertain && !entry.received ? (
                      <Badge variant="outline" className={UNCERTAIN_BADGE_CLASS}>
                        Incerta · avança até receber
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  {entry.uncertain && !entry.received
                    ? "Sem data"
                    : formatDueDay(entry.dueDay, entry.dueDayType)}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {entry.tags.map((tag) => (
                      <Badge key={tag.id} variant="secondary">
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <MoneyText
                    value={entry.amount}
                    tone={entry.uncertain && !entry.received ? "uncertain" : "default"}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={entry.received}
                    disabled={pending}
                    onCheckedChange={(checked) => toggleReceived(entry.id, checked)}
                  />
                </TableCell>
                <TableCell className="flex items-center justify-end gap-1">
                  <IncomeEntryDialog
                    month={month}
                    entry={entry}
                    triggerLabel="Editar"
                    triggerVariant="ghost"
                    triggerSize="xs"
                    allTags={allTags}
                  />
                  <DeleteEntryButton
                    month={month}
                    name={entry.name}
                    kind="income"
                    isRecurring={entry.isRecurring}
                    disabled={pending}
                    onDelete={(scope) => remove(entry.id, scope)}
                  />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
