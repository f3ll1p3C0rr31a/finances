export function formatCurrency(value: number): string {
  // Normalize -0 (e.g. from `-someZeroTotal`) so it doesn't render as "-R$ 0,00".
  const normalized = value === 0 ? 0 : value
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(normalized)
}

/**
 * Tailwind color classes for a monetary value: green for positive,
 * red for negative, with a more saturated shade for larger magnitudes.
 */
export function moneyColorClass(value: number): string {
  const abs = Math.abs(value)
  if (value > 0) {
    if (abs >= 10000) return "text-emerald-700 dark:text-emerald-400 font-semibold"
    if (abs >= 1000) return "text-emerald-600 dark:text-emerald-400"
    return "text-emerald-600/80 dark:text-emerald-400/80"
  }
  if (value < 0) {
    if (abs >= 10000) return "text-red-700 dark:text-red-400 font-semibold"
    if (abs >= 1000) return "text-red-600 dark:text-red-400"
    return "text-red-600/80 dark:text-red-400/80"
  }
  return "text-muted-foreground"
}

export function formatDueDay(
  dueDay: number | null,
  dueDayType: "CALENDAR_DAY" | "BUSINESS_DAY"
): string {
  if (dueDay == null) return "—"
  return dueDayType === "BUSINESS_DAY" ? `${dueDay}º dia útil` : `Dia ${dueDay}`
}
