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

  // Mesma grade do MonthNav: setas presas nas bordas, miolo empilhando no
  // celular. Ver o comentário lá para o porquê de não usar flex-wrap.
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:gap-3">
      <Link
        href={`${basePath}?month=${previous}`}
        className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}
        aria-label="Mês anterior"
      >
        ←<span className="ml-1 hidden sm:inline">Anterior</span>
      </Link>
      <div className="flex min-w-0 flex-col items-center gap-1.5 sm:flex-row sm:justify-center sm:gap-3">
        <h2 className="truncate text-lg font-semibold tracking-tight sm:text-xl">
          {formatMonthLabel(month)}
        </h2>
        <Link
          href={home}
          className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "shrink-0")}
        >
          {homeLabel}
        </Link>
      </div>
      <Link
        href={`${basePath}?month=${next}`}
        className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}
        aria-label="Próximo mês"
      >
        <span className="mr-1 hidden sm:inline">Próximo</span>→
      </Link>
    </div>
  )
}
