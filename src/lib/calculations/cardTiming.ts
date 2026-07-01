import { addMonths, dateWithDay, daysInMonth } from "./month"

/**
 * The best day to buy on a card is the day right after it closes:
 * a purchase made then rides the next billing cycle, maximizing the
 * time before it's due. Rolls over into the 1st of the next month
 * when the closing day is the last day of the month.
 */
export function bestPurchaseDate(closingDay: number, month: Date): Date {
  if (closingDay >= daysInMonth(month)) {
    return dateWithDay(addMonths(month, 1), 1)
  }
  return dateWithDay(month, closingDay + 1)
}
