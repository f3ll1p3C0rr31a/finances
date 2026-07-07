import Link from "next/link"

import {
  addMonths,
  currentMonth,
  formatMonthLabel,
  monthKeyFromDate,
} from "@/lib/calculations/month"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function MonthNav({ month }: { month: Date }) {
  const prev = monthKeyFromDate(addMonths(month, -1))
  const next = monthKeyFromDate(addMonths(month, 1))
  const current = monthKeyFromDate(currentMonth())

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link href={`/dashboard/${prev}`} className={cn(buttonVariants({ variant: "outline" }))}>
        ← Anterior
      </Link>
      <div className="flex flex-col items-center gap-2 sm:flex-row">
        <h1 className="text-2xl font-semibold tracking-tight">{formatMonthLabel(month)}</h1>
        <Link href={`/dashboard/${current}`} className={cn(buttonVariants({ variant: "secondary" }))}>
          Mês atual
        </Link>
      </div>
      <Link href={`/dashboard/${next}`} className={cn(buttonVariants({ variant: "outline" }))}>
        Próximo →
      </Link>
    </div>
  )
}
