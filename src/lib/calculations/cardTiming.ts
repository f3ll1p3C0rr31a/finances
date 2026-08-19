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

export type CardCycle = { closingDay: number | null; paymentDay: number | null }

/**
 * Returns the invoice due month that should receive a purchase.
 *
 * The app treats `billingMonth` as the month where the invoice is paid
 * in the dashboard. A purchase made on or before the closing day belongs
 * to the invoice that closes in the same calendar month; after the
 * closing day it belongs to the invoice that closes in the next month.
 * The payment month then depends on where the due day sits relative to
 * the closing day:
 *
 * - Nubank-style (closes day 2, due day 10): the invoice is paid in the
 *   same month it closes, so a purchase on 07/07 closes on 02/08 and is
 *   paid on 10/08 — billingMonth = August.
 * - Closes day 23, due day 1: the invoice is paid in the month after it
 *   closes, so a purchase on 20/07 closes on 23/07 and is paid on 01/08;
 *   a purchase on 24/07 closes on 23/08 and is paid on 01/09.
 *
 * Without a paymentDay the payment is assumed to happen in the month
 * after the closing (the previous behavior of this rule).
 */
export function invoiceMonthForPurchase(card: CardCycle, purchaseDate: Date): Date {
  const purchaseMonth = new Date(
    Date.UTC(purchaseDate.getUTCFullYear(), purchaseDate.getUTCMonth(), 1)
  )

  if (card.closingDay == null) return purchaseMonth

  const closingDay = Math.min(card.closingDay, daysInMonth(purchaseMonth))
  const closingMonthOffset = purchaseDate.getUTCDate() > closingDay ? 1 : 0
  const paymentMonthOffset =
    card.paymentDay != null && card.paymentDay > card.closingDay ? 0 : 1
  return addMonths(purchaseMonth, closingMonthOffset + paymentMonthOffset)
}

/**
 * Inverse of invoiceMonthForPurchase for recurring charges: finds the
 * calendar date (day `chargeDay`) whose charge lands on the invoice paid
 * in `billingMonth`. Every billing month maps back to exactly one charge
 * date, at most two months earlier.
 */
export function chargeDateForBillingMonth(
  card: CardCycle,
  chargeDay: number,
  billingMonth: Date
): Date | null {
  for (let offset = 0; offset <= 2; offset++) {
    const chargeDate = dateWithDay(addMonths(billingMonth, -offset), chargeDay)
    if (invoiceMonthForPurchase(card, chargeDate).getTime() === billingMonth.getTime()) {
      return chargeDate
    }
  }
  return null
}

/**
 * Mês de faturamento da fatura que está aberta hoje — a que ainda recebe
 * compras. É o mesmo destino que uma compra feita agora teria, então antes do
 * fechamento é a fatura que vence neste ciclo e, a partir do dia seguinte ao
 * fechamento, já é a próxima.
 *
 * Cartão sem fechamento clássico cai no mês corrente, como no resto do app.
 */
export function openInvoiceMonth(card: CardCycle, reference: Date = new Date()): Date {
  const today = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate())
  )
  return invoiceMonthForPurchase(card, today)
}
