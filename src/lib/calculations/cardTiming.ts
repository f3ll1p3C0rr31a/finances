import { addMonths, dateWithDay, daysInMonth } from "./month"

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

/**
 * Returns the invoice month that should receive a purchase. When a card has a
 * closing day, purchases after that day belong to the next invoice; purchases
 * on or before the closing day still belong to the current invoice.
 */
export function invoiceMonthForPurchase(
  card: { closingDay: number | null },
  purchaseDate: Date
): Date {
  const purchaseMonth = new Date(
    Date.UTC(purchaseDate.getUTCFullYear(), purchaseDate.getUTCMonth(), 1)
  )

  if (card.closingDay == null) return purchaseMonth

  const closingDay = Math.min(card.closingDay, daysInMonth(purchaseMonth))
  return purchaseDate.getUTCDate() > closingDay ? addMonths(purchaseMonth, 1) : purchaseMonth
}
