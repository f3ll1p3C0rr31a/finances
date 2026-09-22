"use client"

import { useState } from "react"

import { monthFromKey, formatMonthLabel } from "@/lib/calculations/month"
import type { RecurrenceScope } from "@/lib/validation/schemas"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

type Props = {
  /** Mês aberto, em `AAAA-MM`. */
  month: string
  name: string
  kind: "income" | "expense"
  isRecurring: boolean
  disabled?: boolean
  onDelete: (scope: RecurrenceScope) => void
}

/**
 * Excluir um lançamento avulso é direto. Um recorrente precisa da pergunta:
 * apagar só o mês aberto ou encerrar a recorrência dali em diante — as duas
 * respostas são destrutivas de formas bem diferentes.
 */
export function DeleteEntryButton({
  month,
  name,
  kind,
  isRecurring,
  disabled,
  onDelete,
}: Props) {
  const [open, setOpen] = useState(false)
  const noun = kind === "income" ? "entrada" : "despesa"
  const monthLabel = formatMonthLabel(monthFromKey(month))

  if (!isRecurring) {
    return (
      <Button
        variant="ghost"
        size="xs"
        disabled={disabled}
        onClick={() => onDelete("ONLY_THIS")}
      >
        Excluir
      </Button>
    )
  }

  function choose(scope: RecurrenceScope) {
    setOpen(false)
    onDelete(scope)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="xs" disabled={disabled} />}>
        Excluir
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir {name}</DialogTitle>
          <DialogDescription>
            É uma {noun} recorrente. O que você quer excluir?
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-auto flex-col items-start gap-1 py-3 text-left"
            onClick={() => choose("ONLY_THIS")}
          >
            <span className="font-medium">Apenas {monthLabel}</span>
            <span className="text-xs font-normal text-muted-foreground">
              A {noun} some só neste mês e continua nos seguintes.
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto flex-col items-start gap-1 py-3 text-left"
            onClick={() => choose("THIS_AND_FUTURE")}
          >
            <span className="font-medium">{monthLabel} e os meses seguintes</span>
            <span className="text-xs font-normal text-muted-foreground">
              Encerra a recorrência. Os meses anteriores são preservados.
            </span>
          </Button>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
