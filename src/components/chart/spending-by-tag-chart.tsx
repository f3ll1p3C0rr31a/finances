"use client"

import { useMemo, useState } from "react"
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts"

import type { SpendingRow } from "@/lib/actions/spendingByTag"
import { formatCurrency } from "@/lib/calculations/format"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const FILTER_LABELS = {
  ALL: "Todas",
  CASH: "Dinheiro",
  PIX: "Pix",
  TRANSFER: "Transferência",
  BOLETO: "Boleto",
  CARD: "Cartão",
  OTHER: "Outro",
} as const

type FilterKey = keyof typeof FILTER_LABELS

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--primary)",
  "var(--destructive)",
]

export function SpendingByTagChart({ rows }: { rows: SpendingRow[] }) {
  const [filter, setFilter] = useState<FilterKey>("ALL")

  const data = useMemo(() => {
    const filtered = filter === "ALL" ? rows : rows.filter((r) => r.paymentMethod === filter)
    const totals = new Map<string, number>()
    for (const row of filtered) {
      totals.set(row.tagName, (totals.get(row.tagName) ?? 0) + row.amount)
    }
    return Array.from(totals.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [rows, filter])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Filtrar por forma de pagamento</p>
        <Select value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
          <SelectTrigger className="w-44">
            <SelectValue>{(value: string) => FILTER_LABELS[value as FilterKey]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(FILTER_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum gasto etiquetado neste mês.</p>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" outerRadius={100} label>
                {data.map((entry, index) => (
                  <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
