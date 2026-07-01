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

export function currentMonth(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}
