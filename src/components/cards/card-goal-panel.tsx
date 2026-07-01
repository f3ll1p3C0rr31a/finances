"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { setCardGoal } from "@/lib/actions/cards"
import { formatCurrency } from "@/lib/calculations/format"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Props = {
  month: string
  goal: number | null
  spent: number
  remaining: number
  perDay: number
  daysLeft: number
}

export function CardGoalPanel({ month, goal, spent, remaining, perDay, daysLeft }: Props) {
  const [value, setValue] = useState(goal?.toString() ?? "")
  const [pending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      try {
        const [year, monthIndex] = month.split("-").map(Number)
        const monthDate = new Date(Date.UTC(year, monthIndex - 1, 1))
        await setCardGoal(monthDate, { amount: value === "" ? 0 : Number(value) })
        toast.success("Meta atualizada.")
      } catch {
        toast.error("Não foi possível atualizar a meta.")
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Meta de gastos do mês</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="goal-amount">Meta combinada dos cartões</Label>
          <div className="flex gap-2">
            <Input
              id="goal-amount"
              type="number"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <Button onClick={save} disabled={pending}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-muted-foreground">Gasto no mês</dt>
          <dd className="text-right">{formatCurrency(spent)}</dd>
          <dt className="text-muted-foreground">Restante dentro da meta</dt>
          <dd className={`text-right ${remaining < 0 ? "text-destructive" : ""}`}>
            {formatCurrency(remaining)}
          </dd>
          <dt className="font-medium">Você pode gastar por dia</dt>
          <dd className="text-right font-medium">
            {formatCurrency(perDay)} <span className="text-muted-foreground">/ {daysLeft}d</span>
          </dd>
        </dl>
      </CardContent>
    </Card>
  )
}
