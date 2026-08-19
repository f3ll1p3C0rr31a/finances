import { userIdFromRequest } from "@/lib/services/deviceTokens"
import { getMonthData } from "@/lib/actions/monthly"
import { getCardGoalData, getCardsOpenInvoiceSummary } from "@/lib/actions/cardSummary"
import { currentMonth, formatMonthLabel, monthKeyFromDate } from "@/lib/calculations/month"

export const dynamic = "force-dynamic"

/**
 * Resumo do mês para o widget do Android: o que cabe numa tela inicial —
 * saldo planejado, quanto já foi e quanto falta, e a situação da meta dos
 * cartões. Autenticado por token de dispositivo, não por sessão.
 */
export async function GET(request: Request) {
  const userId = await userIdFromRequest(request)
  if (!userId) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }

  const month = currentMonth()
  const [data, goal, openInvoices] = await Promise.all([
    getMonthData(userId, month),
    getCardGoalData(userId, month),
    getCardsOpenInvoiceSummary(userId),
  ])

  return Response.json(
    {
      month: monthKeyFromDate(month),
      monthLabel: formatMonthLabel(month),
      currentBalance: (data.balance.actualBalance ?? data.balance.openingBalance).toNumber(),
      plannedBalance: data.plannedBalance.toNumber(),
      previewBalance: data.previewBalance.toNumber(),
      futureIncome: data.futureIncome.toNumber(),
      futureExpense: data.futureExpense.toNumber(),
      cardGoal: {
        goal: goal.goal?.toNumber() ?? null,
        projectionMonth: monthKeyFromDate(goal.projectionMonth),
        projectedSpent: goal.projectedCombinedTotal.toNumber(),
        remaining: goal.progress.remaining.toNumber(),
        perDay: goal.progress.perDay.toNumber(),
        daysLeft: goal.progress.daysLeft,
      },
      // Fatura em aberto de cada cartão: é o número que o widget mostra e a
      // lista que o lançamento rápido oferece.
      cards: openInvoices.summaries.map((summary) => ({
        id: summary.card.id,
        name: summary.card.name,
        invoiceMonth: monthKeyFromDate(summary.month),
        invoiceMonthLabel: formatMonthLabel(summary.month),
        total: summary.total.toNumber(),
        paid: summary.paid,
        closingDay: summary.card.closingDay,
        paymentDay: summary.card.paymentDay,
      })),
      updatedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}
