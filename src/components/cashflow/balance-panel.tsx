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
  futureIncome: number
  totalExpense: number
  futureExpense: number
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
  futureIncome,
  totalExpense,
  futureExpense,
  difference,
  plannedBalance,
  previewBalance,
  pendingUncertainIncome,
  pendingUncertainExpense,
  actualBalance,
  actualBalanceAt,
}: Props) {
  const [value, setValue] = useState(actualBalance ?? openingBalance)
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
        <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 text-sm">
          <dt>
            <span className="block font-medium">Saldo Inicial</span>
            <span className="text-xs text-muted-foreground">
              Saldo herdado do mês anterior
            </span>
          </dt>
          <dd className="self-center text-right">
            <MoneyText value={openingBalance} />
          </dd>
          <dt>
            <span className="block font-medium">Total de Entrada</span>
            <span className="text-xs text-muted-foreground">
              Todas as entradas combinadas
            </span>
          </dt>
          <dd className="self-center text-right">
            <MoneyText value={totalIncome} />
          </dd>
          <dt>
            <span className="block font-medium">Entradas Futuras</span>
            <span className="text-xs text-muted-foreground">
              Entradas do mês ainda não recebidas
            </span>
          </dt>
          <dd className="self-center text-right">
            <MoneyText value={futureIncome} />
          </dd>
          <dt>
            <span className="block font-medium">Total de Saídas</span>
            <span className="text-xs text-muted-foreground">
              Todas as saídas do mês
            </span>
          </dt>
          <dd className="self-center text-right">
            <MoneyText value={-totalExpense} />
          </dd>
          <dt>
            <span className="block font-medium">Saídas Futuras</span>
            <span className="text-xs text-muted-foreground">
              Despesas, cartões e assinaturas ainda em aberto
            </span>
          </dt>
          <dd className="self-center text-right">
            <MoneyText value={-futureExpense} />
          </dd>
          <dt>
            <span className="block font-medium">Diferença</span>
            <span className="text-xs text-muted-foreground">
              Entradas combinadas menos saídas combinadas
            </span>
          </dt>
          <dd className="self-center text-right">
            <MoneyText value={difference} />
          </dd>
          <dt className="font-medium">Saldo planejado</dt>
          <dd className="text-right font-medium self-center">
            <MoneyText value={plannedBalance} />
          </dd>
        </dl>
        <div className="flex flex-col gap-2 border-t pt-3">
          <Label htmlFor="actual-balance">Saldo Atual</Label>
          <div className="flex max-w-56 gap-2">
            <CurrencyInput id="actual-balance" value={value} onChange={setValue} />
            <Button onClick={save} disabled={pending} size="sm">
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
          {actualBalanceAt ? (
            <p className="text-xs text-muted-foreground">
              Atualizado em {new Date(actualBalanceAt).toLocaleString("pt-BR")}. Os botões
              Pago e Recebido atualizam este saldo automaticamente.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Ainda não atualizado — o primeiro pagamento ou recebimento partirá do saldo
              inicial.
            </p>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-2 border-t pt-3 text-sm">
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
      </CardContent>
    </Card>
  )
}
