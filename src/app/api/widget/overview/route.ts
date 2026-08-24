import { userIdFromRequest } from "@/lib/services/deviceTokens"
import { getMonthData } from "@/lib/actions/monthly"
import { getCardGoalData, getCardsOpenInvoiceSummary } from "@/lib/actions/cardSummary"
import { addMonths, currentMonth, formatMonthLabel, monthKeyFromDate } from "@/lib/calculations/month"
import { listTags } from "@/lib/actions/tags"

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
  const [data, openInvoices, tags] = await Promise.all([
    getMonthData(userId, month),
    getCardsOpenInvoiceSummary(userId),
    listTags(userId),
  ])

  // Qual meta rege o que se gasta HOJE.
  //
  // A meta cadastrada no mês M é comparada com a fatura de M+1. Uma compra
  // feita agora cai na fatura em aberto do cartão, que depois do fechamento já
  // é a do mês seguinte — então a meta que a governa é `fatura aberta - 1`.
  //
  // Entre os cartões vale o que já virou (fatura aberta mais distante): é nele
  // que as compras novas caem. Com o Inter fechando dia 23, a partir do dia 24
  // o widget passa sozinho a mostrar a meta do mês seguinte, e volta ao mês
  // corrente na virada. Um "+1" fixo acertaria só esses últimos dias do mês.
  const latestOpenInvoice = openInvoices.summaries.reduce<Date>(
    (latest, summary) => (summary.month > latest ? summary.month : latest),
    month
  )
  const goalMonth = addMonths(latestOpenInvoice, -1)
  const goal = await getCardGoalData(userId, goalMonth)

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
        // O mês da meta muda ao longo do mês; sem rótulo o número trocaria de
        // significado sem avisar.
        month: monthKeyFromDate(goalMonth),
        monthLabel: formatMonthLabel(goalMonth),
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
      // Etiquetas vão junto para o lançamento rápido não precisar de uma
      // segunda chamada antes de mostrar o formulário.
      tags: tags.map((tag) => ({ id: tag.id, name: tag.name })),
      updatedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}
