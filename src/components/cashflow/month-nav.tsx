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

  // Grid de três colunas em vez de flex-wrap: com wrap, os três botões caem
  // em linhas separadas no celular e ficam desalinhados. Aqui as setas ficam
  // presas nas bordas e o miolo empilha título e atalho quando falta largura.
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:gap-3">
      <Link
        href={`/dashboard/${prev}`}
        className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}
        aria-label="Mês anterior"
      >
        ←<span className="ml-1 hidden sm:inline">Anterior</span>
      </Link>
      <div className="flex min-w-0 flex-col items-center gap-1.5 sm:flex-row sm:justify-center sm:gap-3">
        <h1 className="truncate text-lg font-semibold tracking-tight sm:text-2xl">
          {formatMonthLabel(month)}
        </h1>
        <Link
          href={`/dashboard/${current}`}
          className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "shrink-0")}
        >
          Mês atual
        </Link>
      </div>
      <Link
        href={`/dashboard/${next}`}
        className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}
        aria-label="Próximo mês"
      >
        <span className="mr-1 hidden sm:inline">Próximo</span>→
      </Link>
    </div>
  )
}
