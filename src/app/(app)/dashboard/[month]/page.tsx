import { notFound } from "next/navigation"

import { requireUserId } from "@/lib/session"
import { getMonthData } from "@/lib/actions/monthly"
import { getBalanceChartRanges } from "@/lib/actions/chart"
import { getCardGoalData } from "@/lib/actions/cardSummary"
import { listTags } from "@/lib/actions/tags"
import { listPixKeys } from "@/lib/actions/pixKeys"
import { getSpendingByTagRows } from "@/lib/actions/spendingByTag"
import { monthFromKey } from "@/lib/calculations/month"
import { bestPurchaseDate } from "@/lib/calculations/cardTiming"
import type {
  SerializedIncomeEntry,
  SerializedExpenseEntry,
  SerializedCardSummary,
} from "@/lib/types"
import { MonthNav } from "@/components/cashflow/month-nav"
import { IncomeTable } from "@/components/cashflow/income-table"
import { ExpenseTable } from "@/components/cashflow/expense-table"
import { BalancePanel } from "@/components/cashflow/balance-panel"
import { MonthCalendar } from "@/components/cashflow/month-calendar"
import { DashboardCharts } from "@/components/chart/dashboard-charts"
import { CardGoalPanel } from "@/components/cards/card-goal-panel"
import { SpendingByTagChart } from "@/components/chart/spending-by-tag-chart"
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
  const data = await getMonthData(userId, month)
  const [history, goalData, allTags, pixPayeeKeys, spendingRows] = await Promise.all([
    getBalanceChartRanges(userId, month),
    getCardGoalData(userId, month),
    listTags(userId),
    listPixKeys(userId, "PAYEE"),
    getSpendingByTagRows(userId, month),
  ])

  const tagRefs = allTags.map((t) => ({ id: t.id, name: t.name }))
  const pixPayees = pixPayeeKeys.map((k) => ({ id: k.id, label: k.label }))

  const incomeEntries: SerializedIncomeEntry[] = data.incomeEntries.map((entry) => ({
    id: entry.id,
    name: entry.name,
    amount: entry.amount.toNumber(),
    dueDay: entry.dueDayValue,
    dueDayType: entry.dueDayType,
    dueDate: entry.dueDate ? entry.dueDate.toISOString() : null,
    received: entry.received,
    isRecurring: entry.templateId != null,
    tags: entry.tags.map((t) => ({ id: t.tag.id, name: t.tag.name })),
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
    tags: entry.tags.map((t) => ({ id: t.tag.id, name: t.tag.name })),
    paymentMethod: entry.paymentMethod,
    pixKeyId: entry.pixKeyId,
    pixKeyLabel: entry.pixKey?.label ?? null,
  }))

  const cardSummaries: SerializedCardSummary[] = data.cardSummaries.map((s) => ({
    id: s.card.id,
    name: s.card.name,
    total: s.total.toNumber(),
    paid: s.paid,
    closingDay: s.card.closingDay,
    bestPurchaseDay: s.card.closingDay
      ? bestPurchaseDate(s.card.closingDay, month).getUTCDate()
      : null,
  }))

  return (
    <div className="flex flex-col gap-6">
      <MonthNav month={month} />
      <CardGoalPanel
        month={monthKey}
        goal={goalData.goal?.toNumber() ?? null}
        spent={goalData.combinedTotal.toNumber()}
        reserve={goalData.reserve.toNumber()}
        remaining={goalData.progress.remaining.toNumber()}
        perDay={goalData.progress.perDay.toNumber()}
        daysLeft={goalData.progress.daysLeft}
      />
      <div className="grid gap-6 lg:grid-cols-2">
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
        <MonthCalendar
          month={month}
          incomeEntries={incomeEntries}
          expenseEntries={expenseEntries}
          cardBestDays={cardSummaries
            .filter((c) => c.bestPurchaseDay != null)
            .map((c) => ({ cardName: c.name, day: c.bestPurchaseDay as number }))}
        />
      </div>
      <IncomeTable month={monthKey} entries={incomeEntries} allTags={tagRefs} />
      <ExpenseTable
        month={monthKey}
        entries={expenseEntries}
        cards={cardSummaries}
        cardReserve={data.cardReserve.toNumber()}
        allTags={tagRefs}
        pixPayees={pixPayees}
      />
      <Card>
        <CardHeader>
          <CardTitle>Gastos por etiqueta</CardTitle>
        </CardHeader>
        <CardContent>
          <SpendingByTagChart rows={spendingRows} />
        </CardContent>
      </Card>
      <DashboardCharts
        year={history.year}
        nextTwelveMonths={history.nextTwelveMonths}
        referenceYear={month.getUTCFullYear()}
      />
    </div>
  )
}
