"use client"

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts"

import type { MonthChartPoint } from "@/lib/actions/chart"
import { formatCurrency } from "@/lib/calculations/format"

export function BalanceChart({ data }: { data: MonthChartPoint[] }) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <defs>
            <linearGradient id="balanceLine" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="var(--chart-2)" />
              <stop offset="100%" stopColor="var(--chart-1)" />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" />
          <XAxis dataKey="label" fontSize={12} />
          <YAxis fontSize={12} tickFormatter={(value: number) => formatCurrency(value)} width={90} />
          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
          <Legend />
          <Line
            type="monotone"
            dataKey="plannedBalance"
            name="Saldo planejado"
            stroke="var(--chart-2)"
            strokeDasharray="6 4"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="balance"
            name="Saldo"
            stroke="url(#balanceLine)"
            strokeWidth={3}
            dot={{ r: 3, fill: "var(--chart-1)" }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function IncomeExpenseChart({ data }: { data: MonthChartPoint[] }) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" />
          <XAxis dataKey="label" fontSize={12} />
          <YAxis fontSize={12} tickFormatter={(value: number) => formatCurrency(value)} width={90} />
          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
          <Legend />
          <Bar dataKey="totalIncome" name="Entradas" fill="var(--chart-2)" radius={[8, 8, 0, 0]} />
          <Bar dataKey="totalExpense" name="Saídas" fill="var(--chart-1)" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
