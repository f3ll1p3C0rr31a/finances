import { dateWithDay, daysInMonth } from "./month"

/**
 * By default, the best day to buy is the day immediately before the
 * card closes. Some cards do not have a classic closing cycle, so
 * cards may override this with an explicit bestPurchaseDay.
 */
export function defaultBestPurchaseDay(closingDay: number | null, month: Date): number | null {
  if (closingDay == null) return null
  if (closingDay <= 1) return daysInMonth(month)
  return Math.min(closingDay - 1, daysInMonth(month))
}

export function bestPurchaseDateForCard(
  card: { closingDay: number | null; bestPurchaseDay: number | null },
  month: Date
): Date | null {
  const day = card.bestPurchaseDay ?? defaultBestPurchaseDay(card.closingDay, month)
  return day == null ? null : dateWithDay(month, day)
}
