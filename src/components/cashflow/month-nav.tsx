import Link from "next/link"

import { addMonths, formatMonthLabel, monthKeyFromDate } from "@/lib/calculations/month"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function MonthNav({ month }: { month: Date }) {
  const prev = monthKeyFromDate(addMonths(month, -1))
  const next = monthKeyFromDate(addMonths(month, 1))

  return (
    <div className="flex items-center justify-between">
      <Link href={`/cashflow/${prev}`} className={cn(buttonVariants({ variant: "outline" }))}>
        ← Anterior
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{formatMonthLabel(month)}</h1>
      <Link href={`/cashflow/${next}`} className={cn(buttonVariants({ variant: "outline" }))}>
        Próximo →
      </Link>
    </div>
  )
}
