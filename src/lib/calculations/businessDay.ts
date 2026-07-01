import { daysInMonth, dateWithDay } from "./month"

function computeEaster(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(year, month - 1, day))
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime())
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

function dateKey(date: Date): string {
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`
}

/**
 * Brazilian national holidays plus the movable bank holidays (Carnaval,
 * Sexta-feira Santa, Corpus Christi) that in practice shift due dates,
 * even though some aren't strictly federal holidays.
 */
function brazilianHolidays(year: number): Date[] {
  const easter = computeEaster(year)
  return [
    new Date(Date.UTC(year, 0, 1)), // Confraternização Universal
    addDays(easter, -47), // Carnaval (segunda)
    addDays(easter, -46), // Carnaval (terça)
    addDays(easter, -2), // Sexta-feira Santa
    addDays(easter, 60), // Corpus Christi
    new Date(Date.UTC(year, 3, 21)), // Tiradentes
    new Date(Date.UTC(year, 4, 1)), // Dia do Trabalho
    new Date(Date.UTC(year, 8, 7)), // Independência
    new Date(Date.UTC(year, 9, 12)), // Nossa Senhora Aparecida
    new Date(Date.UTC(year, 10, 2)), // Finados
    new Date(Date.UTC(year, 10, 15)), // Proclamação da República
    new Date(Date.UTC(year, 10, 20)), // Consciência Negra
    new Date(Date.UTC(year, 11, 25)), // Natal
  ]
}

const holidayCache = new Map<number, Set<string>>()

function holidaySetForYear(year: number): Set<string> {
  let cached = holidayCache.get(year)
  if (!cached) {
    cached = new Set(brazilianHolidays(year).map(dateKey))
    holidayCache.set(year, cached)
  }
  return cached
}

export function isBusinessDay(date: Date): boolean {
  const weekday = date.getUTCDay()
  if (weekday === 0 || weekday === 6) return false
  return !holidaySetForYear(date.getUTCFullYear()).has(dateKey(date))
}

/**
 * Returns the date of the Nth business day of the given month. If the
 * month doesn't have N business days, returns its last business day
 * instead of overflowing into the next month.
 */
export function nthBusinessDayOfMonth(month: Date, n: number): Date {
  const total = daysInMonth(month)
  let count = 0
  let lastBusinessDay = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1))

  for (let day = 1; day <= total; day++) {
    const candidate = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), day))
    if (isBusinessDay(candidate)) {
      count++
      lastBusinessDay = candidate
      if (count === n) return candidate
    }
  }

  return lastBusinessDay
}

export type DueDayType = "CALENDAR_DAY" | "BUSINESS_DAY"

/**
 * Resolves a due day (either a fixed calendar day or the Nth business
 * day) into a concrete date within `month`.
 */
export function resolveDueDate(
  month: Date,
  dueDayType: DueDayType,
  dueDayValue: number
): Date {
  return dueDayType === "BUSINESS_DAY"
    ? nthBusinessDayOfMonth(month, dueDayValue)
    : dateWithDay(month, dueDayValue)
}
