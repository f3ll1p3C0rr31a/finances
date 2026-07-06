"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { setCardGoal } from "@/lib/actions/cards"
import { formatMonthLabel, monthFromKey } from "@/lib/calculations/month"
import { MoneyText } from "@/components/ui/money-text"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Props = {
  month: string
  projectionMonth: string
  goal: number | null
  projectedSpent: number
  invoiceSpent: number
  reserve: number
  remaining: number
  perDay: number
  daysLeft: number
}

export function CardGoalPanel({
  month,
  projectionMonth,
  goal,
  projectedSpent,
  invoiceSpent,
  reserve,
  remaining,
  perDay,
  daysLeft,
}: Props) {
  const [value, setValue] = useState(goal ?? 0)
  const [pending, startTransition] = useTransition()
  const projectionLabel = formatMonthLabel(monthFromKey(projectionMonth))

  function save() {
    startTransition(async () => {
      try {
        const [year, monthIndex] = month.split("-").map(Number)
        const monthDate = new Date(Date.UTC(year, monthIndex - 1, 1))
        await setCardGoal(monthDate, { amount: value })
        toast.success("Meta atualizada.")
      } catch {
        toast.error("Não foi possível atualizar a meta.")
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Meta de gastos dos cartões</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="goal-amount">Meta combinada dos cartões</Label>
          <div className="flex max-w-56 gap-2">
            <CurrencyInput id="goal-amount" value={value} onChange={setValue} />
            <Button onClick={save} disabled={pending} size="sm">
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            A meta deste mês compara o que já está previsto para a próxima fatura
            ({projectionLabel}) e reserva apenas a diferença.
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-muted-foreground">Fatura do mês</dt>
          <dd className="text-right">
            <MoneyText value={-invoiceSpent} />
          </dd>
          <dt className="text-muted-foreground">Já previsto na próxima fatura</dt>
          <dd className="text-right">
            <MoneyText value={-projectedSpent} />
          </dd>
          <dt className="text-muted-foreground">Restante dentro da meta</dt>
          <dd className="text-right">
            <MoneyText value={remaining} />
          </dd>
          <dt className="text-muted-foreground">Despesa ainda reservada</dt>
          <dd className="text-right">
            <MoneyText value={-reserve} />
          </dd>
          <dt className="font-medium">Você pode gastar por dia</dt>
          <dd className="text-right font-medium">
            <MoneyText value={perDay} /> <span className="text-muted-foreground">/ {daysLeft}d</span>
          </dd>
        </dl>
      </CardContent>
    </Card>
  )
}
