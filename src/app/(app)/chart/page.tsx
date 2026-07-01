import { requireUserId } from "@/lib/session"
import { getBalanceHistory } from "@/lib/actions/chart"
import { BalanceChart, IncomeExpenseChart } from "@/components/chart/balance-chart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function ChartPage() {
  const userId = await requireUserId()
  const data = await getBalanceHistory(userId)

  if (data.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Gráfico</h1>
        <p className="text-muted-foreground">
          Ainda não há meses registrados. Crie lançamentos no fluxo de caixa para ver a evolução aqui.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Gráfico</h1>
      <Card>
        <CardHeader>
          <CardTitle>Saldo ao longo do tempo</CardTitle>
        </CardHeader>
        <CardContent>
          <BalanceChart data={data} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Entradas vs. saídas</CardTitle>
        </CardHeader>
        <CardContent>
          <IncomeExpenseChart data={data} />
        </CardContent>
      </Card>
    </div>
  )
}
