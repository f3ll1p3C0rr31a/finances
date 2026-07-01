"use client"

import { useTransition } from "react"
import { toast } from "sonner"

import type { SerializedIncomeEntry } from "@/lib/types"
import { setIncomeReceived, deleteIncomeEntry } from "@/lib/actions/income"
import { formatCurrency, formatDueDay } from "@/lib/calculations/format"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { IncomeEntryDialog } from "@/components/cashflow/income-entry-dialog"

export function IncomeTable({
  month,
  entries,
}: {
  month: string
  entries: SerializedIncomeEntry[]
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

  function remove(id: string) {
    startTransition(async () => {
      try {
        await deleteIncomeEntry(id)
        toast.success("Entrada removida.")
      } catch {
        toast.error("Não foi possível remover.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Entradas</h2>
        <IncomeEntryDialog month={month} triggerLabel="Nova entrada" triggerSize="sm" />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Dia</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="text-center">Recebido</TableHead>
            <TableHead className="w-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Nenhuma entrada neste mês.
              </TableCell>
            </TableRow>
          ) : (
            entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-medium">{entry.name}</TableCell>
                <TableCell>{formatDueDay(entry.dueDay, entry.dueDayType)}</TableCell>
                <TableCell className="text-right">{formatCurrency(entry.amount)}</TableCell>
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
                  />
                  <Button
                    variant="ghost"
                    size="xs"
                    disabled={pending}
                    onClick={() => remove(entry.id)}
                  >
                    Excluir
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
