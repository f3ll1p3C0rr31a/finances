import { Prisma } from "@/generated/prisma/client"

import { daysInMonth } from "./month"

export function computeGoalProgress(
  goal: Prisma.Decimal,
  spent: Prisma.Decimal,
  month: Date,
  today: Date = new Date()
) {
  const remaining = goal.sub(spent)
  const isCurrentMonth =
    today.getUTCFullYear() === month.getUTCFullYear() &&
    today.getUTCMonth() === month.getUTCMonth()
  const daysLeft = isCurrentMonth
    ? Math.max(daysInMonth(month) - today.getUTCDate() + 1, 1)
    : daysInMonth(month)
  const perDay = remaining.gt(0) ? remaining.div(daysLeft) : new Prisma.Decimal(0)

  return { remaining, perDay, daysLeft, isCurrentMonth }
}
