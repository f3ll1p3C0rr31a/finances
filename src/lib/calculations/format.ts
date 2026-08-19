export function formatCurrency(value: number): string {
  // Normalize -0 (e.g. from `-someZeroTotal`) so it doesn't render as "-R$ 0,00".
  const normalized = value === 0 ? 0 : value
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(normalized)
}

/**
 * Como um valor deve ser lido, além do sinal.
 *
 * - `default`: dinheiro certo, que entra ou sai da conta — verde/vermelho.
 * - `uncertain`: lançamento marcado como incerto e ainda não realizado. Ganha
 *   azul/roxo para não se confundir com o dinheiro confirmado; ele não entra
 *   no saldo planejado, só na prévia.
 * - `third-party`: conta de terceiro. Cinza apagado, porque não é o seu
 *   dinheiro que se movimenta.
 */
export type MoneyTone = "default" | "uncertain" | "third-party"

/**
 * Tailwind color classes for a monetary value: green for positive,
 * red for negative, with a more saturated shade for larger magnitudes.
 * `tone` troca a paleta inteira quando o valor não é dinheiro confirmado.
 */
export function moneyColorClass(value: number, tone: MoneyTone = "default"): string {
  if (tone === "third-party") {
    return "text-muted-foreground/70"
  }

  const abs = Math.abs(value)

  if (tone === "uncertain") {
    if (value > 0) {
      if (abs >= 10000) return "text-sky-700 dark:text-sky-300 font-semibold"
      if (abs >= 1000) return "text-sky-600 dark:text-sky-400"
      return "text-sky-600/80 dark:text-sky-400/80"
    }
    if (value < 0) {
      if (abs >= 10000) return "text-violet-700 dark:text-violet-300 font-semibold"
      if (abs >= 1000) return "text-violet-600 dark:text-violet-400"
      return "text-violet-600/80 dark:text-violet-400/80"
    }
    return "text-muted-foreground"
  }

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

/**
 * Classes das etiquetas que marcam a mesma natureza do valor, para que texto e
 * badge contem a mesma história na linha.
 */
export const UNCERTAIN_BADGE_CLASS =
  "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:border-sky-400/40 dark:text-sky-300"

export const THIRD_PARTY_BADGE_CLASS =
  "border-muted-foreground/25 bg-muted/40 text-muted-foreground/80"

export function formatDueDay(
  dueDay: number | null,
  dueDayType: "CALENDAR_DAY" | "BUSINESS_DAY"
): string {
  if (dueDay == null) return "—"
  return dueDayType === "BUSINESS_DAY" ? `${dueDay}º dia útil` : `Dia ${dueDay}`
}
