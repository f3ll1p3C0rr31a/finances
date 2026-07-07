import Link from "next/link"

import { addMonths, formatMonthLabel, monthKeyFromDate } from "@/lib/calculations/month"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function CardMonthNav({ month, basePath = "/cards" }: { month: Date; basePath?: string }) {
  const previous = monthKeyFromDate(addMonths(month, -1))
  const next = monthKeyFromDate(addMonths(month, 1))

  return (
    <div className="flex items-center justify-between gap-3">
      <Link
        href={`${basePath}?month=${previous}`}
        className={cn(buttonVariants({ variant: "outline" }))}
      >
        ← Anterior
      </Link>
      <h2 className="text-xl font-semibold tracking-tight">{formatMonthLabel(month)}</h2>
      <Link
        href={`${basePath}?month=${next}`}
        className={cn(buttonVariants({ variant: "outline" }))}
      >
        Próximo →
      </Link>
    </div>
  )
}
