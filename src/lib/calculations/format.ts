export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

export function formatDueDay(
  dueDay: number | null,
  dueDayType: "CALENDAR_DAY" | "BUSINESS_DAY"
): string {
  if (dueDay == null) return "—"
  return dueDayType === "BUSINESS_DAY" ? `${dueDay}º dia útil` : `Dia ${dueDay}`
}
