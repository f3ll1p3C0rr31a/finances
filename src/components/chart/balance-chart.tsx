"use client"

import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts"

import type { DailyCashflowPoint, MonthChartPoint } from "@/lib/actions/chart"
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
          <Line
            type="monotone"
            dataKey="totalExpense"
            name="Saídas"
            stroke="var(--destructive)"
            strokeDasharray="3 5"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="difference"
            name="Diferença"
            stroke="var(--chart-3)"
            strokeWidth={2}
            dot={{ r: 2 }}
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
          <Bar dataKey="difference" name="Diferença" fill="var(--chart-3)" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function MonthlyCashflowChart({ data }: { data: DailyCashflowPoint[] }) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <defs>
            <linearGradient id="cashflowIncome" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="cashflowExpense" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--destructive)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--destructive)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" />
          <XAxis dataKey="label" fontSize={12} />
          <YAxis fontSize={12} tickFormatter={(value: number) => formatCurrency(value)} width={90} />
          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
          <Legend />
          <Area
            type="monotone"
            dataKey="cumulativeIncome"
            name="Entradas acumuladas"
            stroke="var(--chart-2)"
            fill="url(#cashflowIncome)"
            strokeWidth={3}
          />
          <Area
            type="monotone"
            dataKey="cumulativeExpense"
            name="Saídas acumuladas"
            stroke="var(--destructive)"
            fill="url(#cashflowExpense)"
            strokeWidth={3}
          />
          <Line
            type="monotone"
            dataKey="difference"
            name="Diferença acumulada"
            stroke="var(--chart-3)"
            strokeDasharray="5 5"
            strokeWidth={2}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
