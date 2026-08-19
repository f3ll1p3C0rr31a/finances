import { requireUserId } from "@/lib/session"
import { getCardGoalData, getCardsOpenInvoiceSummary } from "@/lib/actions/cardSummary"
import { listAccounts } from "@/lib/actions/accounts"
import { ensureSubscriptionChargesGenerated } from "@/lib/services/subscriptionCharges"
import {
  currentMonth,
  formatMonthLabel,
  monthFromKey,
  monthKeyFromDate,
} from "@/lib/calculations/month"
import { bestPurchaseDateForCard } from "@/lib/calculations/cardTiming"
import type { SerializedCardSummary } from "@/lib/types"
import { CardList } from "@/components/cards/card-list"
import { CardGoalPanel } from "@/components/cards/card-goal-panel"
import { NewCardDialog } from "@/components/cards/new-card-dialog"
import { CardMonthNav } from "@/components/cards/card-month-nav"

const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/

export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[] }>
}) {
  const userId = await requireUserId()
  const queryMonth = (await searchParams).month
  const pinnedMonth =
    typeof queryMonth === "string" && MONTH_KEY_PATTERN.test(queryMonth)
      ? monthFromKey(queryMonth)
      : null
  const month = pinnedMonth ?? currentMonth()
  await ensureSubscriptionChargesGenerated(userId)
  // Sem mês fixado na URL, cada cartão mostra a própria fatura em aberto — a
  // que ainda recebe compras. Ao navegar por um mês específico, todos passam a
  // mostrar a fatura daquele mês.
  const [goalData, openInvoices, accounts] = await Promise.all([
    getCardGoalData(userId, month),
    pinnedMonth ? null : getCardsOpenInvoiceSummary(userId),
    listAccounts(userId),
  ])
  const {
    summaries,
    combinedTotal,
    projectedCombinedTotal,
    projectionMonth,
    goal,
    reserve,
    progress,
  } = goalData
  const accountOptions = accounts.map((account) => ({ id: account.id, name: account.name }))

  const listSummaries = openInvoices
    ? openInvoices.summaries
    : summaries.map((s) => ({ ...s, month }))

  const cards: SerializedCardSummary[] = listSummaries.map((s) => ({
    id: s.card.id,
    name: s.card.name,
    accountId: s.card.accountId,
    accountName: s.card.account?.name ?? null,
    total: s.total.toNumber(),
    paid: s.paid,
    closingDay: s.card.closingDay,
    bestPurchaseDay: bestPurchaseDateForCard(s.card, s.month)?.getUTCDate() ?? null,
    paymentDay: s.card.paymentDay,
    cardNumber: s.card.cardNumber,
    invoiceMonth: monthKeyFromDate(s.month),
    invoiceMonthLabel: formatMonthLabel(s.month),
    invoiceOpen: openInvoices != null,
  }))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Cartões</h1>
        <NewCardDialog accounts={accountOptions} />
      </div>
      <CardMonthNav month={month} homeHref="/cards" homeLabel="Faturas em aberto" />
      <CardGoalPanel
        month={monthKeyFromDate(month)}
        projectionMonth={monthKeyFromDate(projectionMonth)}
        goal={goal?.toNumber() ?? null}
        invoiceSpent={combinedTotal.toNumber()}
        projectedSpent={projectedCombinedTotal.toNumber()}
        reserve={reserve.toNumber()}
        remaining={progress.remaining.toNumber()}
        perDay={progress.perDay.toNumber()}
        daysLeft={progress.daysLeft}
      />
      <p className="text-sm text-muted-foreground">
        {openInvoices
          ? "Cada cartão mostra a fatura que ainda está aberta, no ciclo dele. Use a navegação de mês para ver a fatura de um mês específico."
          : `Faturas de ${formatMonthLabel(month)}.`}
      </p>
      <CardList cards={cards} />
    </div>
  )
}
