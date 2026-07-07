import { requireUserId } from "@/lib/session"
import { getCardGoalData } from "@/lib/actions/cardSummary"
import { currentMonth, monthFromKey, monthKeyFromDate } from "@/lib/calculations/month"
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
  const month =
    typeof queryMonth === "string" && MONTH_KEY_PATTERN.test(queryMonth)
      ? monthFromKey(queryMonth)
      : currentMonth()
  const {
    summaries,
    combinedTotal,
    projectedCombinedTotal,
    projectionMonth,
    goal,
    reserve,
    progress,
  } = await getCardGoalData(userId, month)

  const cards: SerializedCardSummary[] = summaries.map((s) => ({
    id: s.card.id,
    name: s.card.name,
    total: s.total.toNumber(),
    paid: s.paid,
    closingDay: s.card.closingDay,
    bestPurchaseDay: bestPurchaseDateForCard(s.card, month)?.getUTCDate() ?? null,
    paymentDay: s.card.paymentDay,
  }))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Cartões</h1>
        <NewCardDialog />
      </div>
      <CardMonthNav month={month} />
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
      <CardList cards={cards} />
    </div>
  )
}
