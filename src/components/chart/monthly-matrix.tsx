"use client"

import type { MonthChartPoint, MonthlyBreakdownItem } from "@/lib/actions/chart"
import { formatCurrency, moneyColorClass } from "@/lib/calculations/format"
import { cn } from "@/lib/utils"

type MatrixRow = {
  key: string
  label: string
  group: MonthlyBreakdownItem["group"] | "summary"
  values: Map<string, number>
  emphasis?: boolean
}

const GROUP_ORDER = {
  card: 0,
  income: 1,
  expense: 2,
  summary: 3,
}

function buildRows(data: MonthChartPoint[]): MatrixRow[] {
  const rows = new Map<string, MatrixRow>()

  for (const month of data) {
    for (const item of month.breakdown) {
      const row = rows.get(item.key) ?? {
        key: item.key,
        label: item.label,
        group: item.group,
        values: new Map<string, number>(),
      }
      row.values.set(month.month, (row.values.get(month.month) ?? 0) + item.value)
      rows.set(item.key, row)
    }
  }

  const dynamicRows = [...rows.values()].sort(
    (a, b) =>
      GROUP_ORDER[a.group] - GROUP_ORDER[b.group] ||
      a.label.localeCompare(b.label, "pt-BR")
  )

  const summaries: Array<{
    key: string
    label: string
    value: (month: MonthChartPoint) => number
    emphasis?: boolean
  }> = [
    { key: "summary:opening", label: "Saldo inicial", value: (month) => month.openingBalance },
    {
      key: "summary:balance",
      label: "Saldo",
      value: (month) => month.balance,
      emphasis: true,
    },
    {
      key: "summary:income",
      label: "Total Entrada",
      value: (month) => month.totalIncome,
      emphasis: true,
    },
    {
      key: "summary:expense",
      label: "Total Saída",
      value: (month) => -month.totalExpense,
      emphasis: true,
    },
    {
      key: "summary:difference",
      label: "Diferença",
      value: (month) => month.totalIncome - month.totalExpense,
      emphasis: true,
    },
  ]

  return [
    ...dynamicRows,
    ...summaries.map((summary) => ({
      key: summary.key,
      label: summary.label,
      group: "summary" as const,
      emphasis: summary.emphasis,
      values: new Map(data.map((month) => [month.month, summary.value(month)])),
    })),
  ]
}

export function MonthlyMatrix({ data }: { data: MonthChartPoint[] }) {
  const rows = buildRows(data)

  return (
    <div className="relative max-h-[70vh] overflow-auto rounded-lg border">
      <table className="min-w-max border-collapse text-xs">
        <thead className="sticky top-0 z-30">
          <tr>
            <th className="sticky left-0 z-40 min-w-56 border bg-blue-500 px-3 py-2 text-left text-white">
              Lançamento
            </th>
            {data.map((month) => (
              <th
                key={month.month}
                className="min-w-28 border bg-blue-500 px-3 py-2 text-right font-medium text-white"
              >
                {month.label}
              </th>
            ))}
            <th className="sticky right-0 z-40 min-w-28 border bg-blue-600 px-3 py-2 text-right text-white">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const total = [...row.values.values()].reduce((sum, value) => sum + value, 0)
            return (
              <tr
                key={row.key}
                className={cn(
                  row.emphasis ? "font-semibold" : undefined,
                  index % 2 === 0 ? "bg-background" : "bg-muted/40"
                )}
              >
                <th
                  className={cn(
                    "sticky left-0 z-10 border px-3 py-2 text-left whitespace-nowrap",
                    index % 2 === 0 ? "bg-background" : "bg-muted"
                  )}
                >
                  {row.label}
                </th>
                {data.map((month) => {
                  const value = row.values.get(month.month)
                  return (
                    <td
                      key={month.month}
                      className={cn(
                        "border px-3 py-2 text-right whitespace-nowrap",
                        value != null ? moneyColorClass(value) : undefined,
                        row.emphasis && value != null
                          ? value >= 0
                            ? "bg-emerald-500/10"
                            : "bg-destructive/10"
                          : undefined
                      )}
                    >
                      {value == null ? "" : formatCurrency(value)}
                    </td>
                  )
                })}
                <td
                  className={cn(
                    "sticky right-0 z-10 border bg-background px-3 py-2 text-right whitespace-nowrap",
                    moneyColorClass(total)
                  )}
                >
                  {formatCurrency(total)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
