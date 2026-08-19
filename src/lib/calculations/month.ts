export function monthKeyFromDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

export function monthFromKey(key: string): Date {
  const [year, month] = key.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, 1))
}

export function addMonths(date: Date, delta: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1))
}

export function daysInMonth(date: Date): number {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
}

export function dateWithDay(month: Date, day: number): Date {
  const clampedDay = Math.min(day, daysInMonth(month))
  return new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), clampedDay))
}

export function formatMonthLabel(date: Date): string {
  const label = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/**
 * Fuso em que "hoje" é decidido. Datas são guardadas normalizadas em UTC, mas
 * a virada do dia — e principalmente a do mês — tem que acontecer à
 * meia-noite de Brasília. Lendo direto o UTC, das 21h do dia 31 em diante o
 * app já mostrava o mês seguinte.
 */
export const APP_TIME_ZONE = "America/Sao_Paulo"

/**
 * Data de hoje no fuso do app, normalizada em UTC (meia-noite).
 *
 * O formato `en-CA` é AAAA-MM-DD, o que evita ter que remontar a data a partir
 * de partes localizadas.
 */
export function today(now: Date = new Date()): Date {
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .split("-")
    .map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

export function currentMonth(): Date {
  const now = today()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}
