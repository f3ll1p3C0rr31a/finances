import { formatCurrency, moneyColorClass, type MoneyTone } from "@/lib/calculations/format"
import { cn } from "@/lib/utils"

export function MoneyText({
  value,
  className,
  colored = true,
  tone = "default",
}: {
  value: number
  className?: string
  colored?: boolean
  tone?: MoneyTone
}) {
  return (
    <span className={cn(colored ? moneyColorClass(value, tone) : undefined, className)}>
      {formatCurrency(value)}
    </span>
  )
}
