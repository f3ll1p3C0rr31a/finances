"use client"

import { useTransition } from "react"
import { toast } from "sonner"

import type { SerializedExpenseEntry } from "@/lib/types"
import { setExpensePaid, deleteExpenseEntry } from "@/lib/actions/expense"
import { formatCurrency } from "@/lib/calculations/format"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ExpenseEntryDialog } from "@/components/cashflow/expense-entry-dialog"

const CATEGORY_LABELS = {
  FIXED: "Fixa",
  VARIABLE: "Variável",
  ONE_OFF: "Avulsa",
}

export function ExpenseTable({
  month,
  entries,
}: {
  month: string
  entries: SerializedExpenseEntry[]
}) {
  const [pending, startTransition] = useTransition()

  function togglePaid(id: string, paid: boolean) {
    startTransition(async () => {
      try {
        await setExpensePaid(id, paid)
      } catch {
        toast.error("Não foi possível atualizar.")
      }
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      try {
        await deleteExpenseEntry(id)
        toast.success("Despesa removida.")
      } catch {
        toast.error("Não foi possível remover.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Despesas</h2>
        <ExpenseEntryDialog month={month} triggerLabel="Nova despesa" triggerSize="sm" />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Dia</TableHead>
            <TableHead>Pago por</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="text-center">Pago</TableHead>
            <TableHead className="w-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                Nenhuma despesa neste mês.
              </TableCell>
            </TableRow>
          ) : (
            entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-medium">{entry.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{CATEGORY_LABELS[entry.category]}</Badge>
                </TableCell>
                <TableCell>{entry.dueDay ?? "—"}</TableCell>
                <TableCell>
                  {entry.paidBy === "THIRD_PARTY" ? (
                    <Badge variant="outline">{entry.paidByName || "Terceiro"}</Badge>
                  ) : (
                    "Eu"
                  )}
                </TableCell>
                <TableCell className="text-right">{formatCurrency(entry.amount)}</TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={entry.paid}
                    disabled={pending}
                    onCheckedChange={(checked) => togglePaid(entry.id, checked)}
                  />
                </TableCell>
                <TableCell className="flex items-center justify-end gap-1">
                  <ExpenseEntryDialog
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
