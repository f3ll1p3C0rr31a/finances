import { auth } from "@/lib/auth"

export default async function DashboardPage() {
  const session = await auth()

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="text-muted-foreground">
        Bem-vindo, {session?.user?.email}. A visão geral mensal aparecerá aqui.
      </p>
    </div>
  )
}
