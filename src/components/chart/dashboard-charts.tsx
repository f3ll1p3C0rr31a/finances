"use client"

import { useState } from "react"

import type { MonthChartPoint } from "@/lib/actions/chart"
import { BalanceChart, IncomeExpenseChart } from "@/components/chart/balance-chart"
import { MonthlyMatrix } from "@/components/chart/monthly-matrix"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type ChartRange = "year" | "nextTwelveMonths"

export function DashboardCharts({
  year,
  nextTwelveMonths,
  referenceYear,
}: {
  year: MonthChartPoint[]
  nextTwelveMonths: MonthChartPoint[]
  referenceYear: number
}) {
  const [range, setRange] = useState<ChartRange>("nextTwelveMonths")
  const data = range === "year" ? year : nextTwelveMonths

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Visão financeira</h2>
          <p className="text-sm text-muted-foreground">
            Compare o ano civil ou acompanhe a projeção móvel.
          </p>
        </div>
        <div className="flex rounded-lg border p-1">
          <Button
            type="button"
            size="sm"
            variant={range === "year" ? "secondary" : "ghost"}
            onClick={() => setRange("year")}
          >
            Ano completo ({referenceYear})
          </Button>
          <Button
            type="button"
            size="sm"
            variant={range === "nextTwelveMonths" ? "secondary" : "ghost"}
            onClick={() => setRange("nextTwelveMonths")}
          >
            Próximos 12 meses
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Planejamento mensal detalhado</CardTitle>
        </CardHeader>
        <CardContent>
          <MonthlyMatrix data={data} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Saldo ao longo do tempo</CardTitle>
        </CardHeader>
        <CardContent>
          <BalanceChart data={data} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Entradas vs. saídas</CardTitle>
        </CardHeader>
        <CardContent>
          <IncomeExpenseChart data={data} />
        </CardContent>
      </Card>
    </div>
  )
}
