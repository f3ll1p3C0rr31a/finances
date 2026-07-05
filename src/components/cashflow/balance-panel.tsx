"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { setActualBalance } from "@/lib/actions/balance"
import { MoneyText } from "@/components/ui/money-text"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Props = {
  month: string
  openingBalance: number
  totalIncome: number
  totalExpense: number
  difference: number
  plannedBalance: number
  previewBalance: number
  pendingUncertainIncome: number
  pendingUncertainExpense: number
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
  previewBalance,
  pendingUncertainIncome,
  pendingUncertainExpense,
  actualBalance,
  actualBalanceAt,
}: Props) {
  const [value, setValue] = useState(actualBalance ?? plannedBalance)
  const [pending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      try {
        const [year, monthIndex] = month.split("-").map(Number)
        const monthDate = new Date(Date.UTC(year, monthIndex - 1, 1))
        await setActualBalance(monthDate, value)
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
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-muted-foreground">Saldo inicial</dt>
          <dd className="text-right">
            <MoneyText value={openingBalance} />
          </dd>
          <dt className="text-muted-foreground">Total entrada</dt>
          <dd className="text-right">
            <MoneyText value={totalIncome} />
          </dd>
          <dt className="text-muted-foreground">Total saída</dt>
          <dd className="text-right">
            <MoneyText value={-totalExpense} />
          </dd>
          <dt className="text-muted-foreground">Diferença</dt>
          <dd className="text-right">
            <MoneyText value={difference} />
          </dd>
          <dt className="font-medium">Saldo planejado</dt>
          <dd className="text-right font-medium">
            <MoneyText value={plannedBalance} />
          </dd>
          <dt className="font-medium">Prévia com valores incertos</dt>
          <dd className="text-right font-medium">
            <MoneyText value={previewBalance} />
          </dd>
        </dl>
        {pendingUncertainIncome > 0 || pendingUncertainExpense > 0 ? (
          <p className="text-xs text-muted-foreground">
            A prévia considera <MoneyText value={pendingUncertainIncome} /> a receber e{" "}
            <MoneyText value={-pendingUncertainExpense} /> a pagar. Esses valores ainda não
            fazem parte do saldo planejado ou real.
          </p>
        ) : null}
        <div className="flex flex-col gap-2 border-t pt-3">
          <Label htmlFor="actual-balance">Saldo real (atualize quando conferir a conta)</Label>
          <div className="flex max-w-56 gap-2">
            <CurrencyInput id="actual-balance" value={value} onChange={setValue} />
            <Button onClick={save} disabled={pending} size="sm">
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
