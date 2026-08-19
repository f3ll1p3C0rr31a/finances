import Link from "next/link"

import {
  addMonths,
  currentMonth,
  formatMonthLabel,
  monthKeyFromDate,
} from "@/lib/calculations/month"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function CardMonthNav({
  month,
  basePath = "/cards",
  homeMonth,
  homeHref,
  homeLabel = "Mês atual",
}: {
  month: Date
  basePath?: string
  /** Mês do atalho de volta; por padrão o mês corrente. */
  homeMonth?: Date
  /** Destino do atalho de volta, quando ele não é um mês fixado na URL. */
  homeHref?: string
  homeLabel?: string
}) {
  const previous = monthKeyFromDate(addMonths(month, -1))
  const next = monthKeyFromDate(addMonths(month, 1))
  const home = homeHref ?? `${basePath}?month=${monthKeyFromDate(homeMonth ?? currentMonth())}`

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link
        href={`${basePath}?month=${previous}`}
        className={cn(buttonVariants({ variant: "outline" }))}
      >
        ← Anterior
      </Link>
      <div className="flex flex-col items-center gap-2 sm:flex-row">
        <h2 className="text-xl font-semibold tracking-tight">{formatMonthLabel(month)}</h2>
        <Link href={home} className={cn(buttonVariants({ variant: "secondary" }))}>
          {homeLabel}
        </Link>
      </div>
      <Link
        href={`${basePath}?month=${next}`}
        className={cn(buttonVariants({ variant: "outline" }))}
      >
        Próximo →
      </Link>
    </div>
  )
}
