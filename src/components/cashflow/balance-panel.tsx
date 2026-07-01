"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { setActualBalance } from "@/lib/actions/balance"
import { formatCurrency } from "@/lib/calculations/format"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Props = {
  month: string
  openingBalance: number
  totalIncome: number
  totalExpense: number
  difference: number
  plannedBalance: number
  actualBalance: number | null
  actualBalanceAt: string | null
}

export function BalancePanel({
  month,
  openingBalance,
  totalIncome,
  totalExpense,
  difference,
  plannedBalance,
  actualBalance,
  actualBalanceAt,
}: Props) {
  const [value, setValue] = useState(actualBalance?.toString() ?? "")
  const [pending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      try {
        const [year, monthIndex] = month.split("-").map(Number)
        const monthDate = new Date(Date.UTC(year, monthIndex - 1, 1))
        const amount = value.trim() === "" ? null : Number(value)
        await setActualBalance(monthDate, amount)
        toast.success("Saldo atualizado.")
      } catch {
        toast.error("Não foi possível atualizar o saldo.")
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumo do mês</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-muted-foreground">Saldo inicial</dt>
          <dd className="text-right">{formatCurrency(openingBalance)}</dd>
          <dt className="text-muted-foreground">Total entrada</dt>
          <dd className="text-right">{formatCurrency(totalIncome)}</dd>
          <dt className="text-muted-foreground">Total saída</dt>
          <dd className="text-right">{formatCurrency(totalExpense)}</dd>
          <dt className="text-muted-foreground">Diferença</dt>
          <dd className="text-right">{formatCurrency(difference)}</dd>
          <dt className="font-medium">Saldo planejado</dt>
          <dd className="text-right font-medium">{formatCurrency(plannedBalance)}</dd>
        </dl>
        <div className="flex flex-col gap-2">
          <Label htmlFor="actual-balance">Saldo real (atualize quando conferir a conta)</Label>
          <div className="flex gap-2">
            <Input
              id="actual-balance"
              type="number"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={plannedBalance.toString()}
            />
            <Button onClick={save} disabled={pending}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
          {actualBalanceAt ? (
            <p className="text-xs text-muted-foreground">
              Atualizado em {new Date(actualBalanceAt).toLocaleString("pt-BR")}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Ainda não atualizado — usando o saldo planejado.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
