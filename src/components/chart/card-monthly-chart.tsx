"use client"

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts"

import type { CardMonthChartPoint } from "@/lib/actions/chart"
import { formatCurrency } from "@/lib/calculations/format"

export function CardMonthlyChart({ data }: { data: CardMonthChartPoint[] }) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" fontSize={12} />
          <YAxis fontSize={12} tickFormatter={(value: number) => formatCurrency(value)} width={90} />
          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
          <Bar dataKey="total" name="Total no mês" fill="var(--chart-1)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
