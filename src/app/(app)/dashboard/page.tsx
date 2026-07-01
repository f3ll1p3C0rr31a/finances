import Link from "next/link"

import { auth } from "@/lib/auth"
import { currentMonth, monthKeyFromDate } from "@/lib/calculations/month"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default async function DashboardPage() {
  const session = await auth()

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="text-muted-foreground">
        Bem-vindo, {session?.user?.email}. A visão geral multi-mês chega em uma
        próxima etapa — por enquanto, acesse o fluxo de caixa do mês atual.
      </p>
      <Link
        href={`/cashflow/${monthKeyFromDate(currentMonth())}`}
        className={cn(buttonVariants({ variant: "default" }), "w-fit")}
      >
        Ver fluxo de caixa
      </Link>
    </div>
  )
}
