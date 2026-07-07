import { addMonths, dateWithDay, daysInMonth } from "./month"

/**
 * By default, the best day to buy is the day immediately after the
 * card closes. A purchase made there enters the next open invoice
 * cycle, so it has the longest time until payment. Some cards do not
 * have a classic closing cycle, so cards may override this with an
 * explicit bestPurchaseDay.
 */
export function defaultBestPurchaseDay(closingDay: number | null, month: Date): number | null {
  if (closingDay == null) return null
  const lastDay = daysInMonth(month)
  return closingDay >= lastDay ? 1 : closingDay + 1
}

export function bestPurchaseDateForCard(
  card: { closingDay: number | null; bestPurchaseDay: number | null },
  month: Date
): Date | null {
  const day = card.bestPurchaseDay ?? defaultBestPurchaseDay(card.closingDay, month)
  return day == null ? null : dateWithDay(month, day)
}

/**
 * Returns the invoice due month that should receive a purchase.
 *
 * The app treats `billingMonth` as the month where the invoice is paid
 * in the dashboard. For a card that closes on day 23 and is due on day 1,
 * a purchase made on 20/07 belongs to the invoice paid in 08; a purchase
 * made after the 23/07 closing belongs to the invoice paid in 09.
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
  return addMonths(purchaseMonth, purchaseDate.getUTCDate() > closingDay ? 2 : 1)
}
