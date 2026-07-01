"use client"

import { useState } from "react"

import type { SerializedIncomeEntry, SerializedExpenseEntry } from "@/lib/types"
import { formatCurrency } from "@/lib/calculations/format"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

// react-day-picker renders in the browser's local timezone, but our
// dates are UTC midnight. Re-anchor to local midnight (same Y/M/D) so
// the calendar shows the intended day/month regardless of the
// browser's UTC offset.
function toLocalMidnight(date: Date): Date {
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function MonthCalendar({
  month,
  incomeEntries,
  expenseEntries,
}: {
  month: Date
  incomeEntries: SerializedIncomeEntry[]
  expenseEntries: SerializedExpenseEntry[]
}) {
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(undefined)

  const incomeDates = incomeEntries
    .filter((e) => e.dueDate)
    .map((e) => toLocalMidnight(new Date(e.dueDate as string)))
  const expenseDates = expenseEntries
    .filter((e) => e.dueDate)
    .map((e) => toLocalMidnight(new Date(e.dueDate as string)))

  const bothDates = incomeDates.filter((d) => expenseDates.some((e) => sameDay(d, e)))
  const onlyIncomeDates = incomeDates.filter((d) => !bothDates.some((b) => sameDay(d, b)))
  const onlyExpenseDates = expenseDates.filter((d) => !bothDates.some((b) => sameDay(d, b)))

  const dayIncome = selectedDay
    ? incomeEntries.filter(
        (e) => e.dueDate && sameDay(toLocalMidnight(new Date(e.dueDate)), selectedDay)
      )
    : []
  const dayExpense = selectedDay
    ? expenseEntries.filter(
        (e) => e.dueDate && sameDay(toLocalMidnight(new Date(e.dueDate)), selectedDay)
      )
    : []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calendário do mês</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <Calendar
          mode="single"
          month={toLocalMidnight(month)}
          selected={selectedDay}
          onSelect={setSelectedDay}
          modifiers={{
            hasIncome: onlyIncomeDates,
            hasExpense: onlyExpenseDates,
            hasBoth: bothDates,
          }}
          modifiersClassNames={{
            hasIncome: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
            hasExpense: "bg-destructive/15 text-destructive",
            hasBoth: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
          }}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {!selectedDay ? (
            <p className="text-sm text-muted-foreground">
              Clique em um dia para ver os lançamentos previstos.
            </p>
          ) : dayIncome.length === 0 && dayExpense.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum lançamento neste dia.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {dayIncome.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    <Badge variant="secondary">Entrada</Badge>
                    {e.name}
                  </span>
                  <span>{formatCurrency(e.amount)}</span>
                </li>
              ))}
              {dayExpense.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    <Badge variant="outline">Saída</Badge>
                    {e.name}
                  </span>
                  <span>{formatCurrency(e.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
