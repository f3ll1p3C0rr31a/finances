import { formatCurrency, moneyColorClass } from "@/lib/calculations/format"
import { cn } from "@/lib/utils"

export function MoneyText({
  value,
  className,
  colored = true,
}: {
  value: number
  className?: string
  colored?: boolean
}) {
  return (
    <span className={cn(colored ? moneyColorClass(value) : undefined, className)}>
      {formatCurrency(value)}
    </span>
  )
}
