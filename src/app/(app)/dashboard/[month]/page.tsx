import { notFound } from "next/navigation"

import { requireUserId } from "@/lib/session"
import { getMonthData } from "@/lib/actions/monthly"
import { getBalanceHistory } from "@/lib/actions/chart"
import { monthFromKey } from "@/lib/calculations/month"
import type {
  SerializedIncomeEntry,
  SerializedExpenseEntry,
  SerializedCardSummary,
} from "@/lib/types"
import { MonthNav } from "@/components/cashflow/month-nav"
import { IncomeTable } from "@/components/cashflow/income-table"
import { ExpenseTable } from "@/components/cashflow/expense-table"
import { BalancePanel } from "@/components/cashflow/balance-panel"
import { CardsSummary } from "@/components/cashflow/cards-summary"
import { MonthCalendar } from "@/components/cashflow/month-calendar"
import { BalanceChart, IncomeExpenseChart } from "@/components/chart/balance-chart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/

export default async function DashboardMonthPage({
  params,
}: {
  params: Promise<{ month: string }>
}) {
  const { month: monthKey } = await params
  if (!MONTH_KEY_PATTERN.test(monthKey)) {
    notFound()
  }

  const userId = await requireUserId()
  const month = monthFromKey(monthKey)
  const [data, history] = await Promise.all([
    getMonthData(userId, month),
    getBalanceHistory(userId),
  ])

  const incomeEntries: SerializedIncomeEntry[] = data.incomeEntries.map((entry) => ({
    id: entry.id,
    name: entry.name,
    amount: entry.amount.toNumber(),
    dueDay: entry.dueDayValue,
    dueDayType: entry.dueDayType,
    dueDate: entry.dueDate ? entry.dueDate.toISOString() : null,
    received: entry.received,
    isRecurring: entry.templateId != null,
  }))

  const expenseEntries: SerializedExpenseEntry[] = data.expenseEntries.map((entry) => ({
    id: entry.id,
    name: entry.name,
    amount: entry.amount.toNumber(),
    category: entry.category,
    dueDay: entry.dueDayValue,
    dueDayType: entry.dueDayType,
    dueDate: entry.dueDate ? entry.dueDate.toISOString() : null,
    paid: entry.paid,
    paidBy: entry.paidBy,
    paidByName: entry.paidByName,
    isRecurring: entry.templateId != null,
  }))

  const cardSummaries: SerializedCardSummary[] = data.cardSummaries.map((s) => ({
    id: s.card.id,
    name: s.card.name,
    total: s.total.toNumber(),
  }))

  return (
    <div className="flex flex-col gap-6">
      <MonthNav month={month} />
      <BalancePanel
        month={monthKey}
        openingBalance={data.balance.openingBalance.toNumber()}
        totalIncome={data.totalIncome.toNumber()}
        totalExpense={data.totalExpense.toNumber()}
        difference={data.difference.toNumber()}
        plannedBalance={data.plannedBalance.toNumber()}
        actualBalance={data.balance.actualBalance?.toNumber() ?? null}
        actualBalanceAt={data.balance.actualBalanceAt?.toISOString() ?? null}
      />
      <MonthCalendar month={month} incomeEntries={incomeEntries} expenseEntries={expenseEntries} />
      <IncomeTable month={monthKey} entries={incomeEntries} />
      <ExpenseTable month={monthKey} entries={expenseEntries} />
      <CardsSummary cards={cardSummaries} />
      {history.length > 0 ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Saldo ao longo do tempo</CardTitle>
            </CardHeader>
            <CardContent>
              <BalanceChart data={history} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Entradas vs. saídas</CardTitle>
            </CardHeader>
            <CardContent>
              <IncomeExpenseChart data={history} />
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}
