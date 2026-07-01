import { requireUserId } from "@/lib/session"
import { getCardGoalData } from "@/lib/actions/cardSummary"
import { currentMonth, monthKeyFromDate } from "@/lib/calculations/month"
import { bestPurchaseDate } from "@/lib/calculations/cardTiming"
import type { SerializedCardSummary } from "@/lib/types"
import { CardList } from "@/components/cards/card-list"
import { CardGoalPanel } from "@/components/cards/card-goal-panel"
import { NewCardDialog } from "@/components/cards/new-card-dialog"

export default async function CardsPage() {
  const userId = await requireUserId()
  const month = currentMonth()
  const { summaries, combinedTotal, goal, progress } = await getCardGoalData(userId, month)

  const cards: SerializedCardSummary[] = summaries.map((s) => ({
    id: s.card.id,
    name: s.card.name,
    total: s.total.toNumber(),
    closingDay: s.card.closingDay,
    bestPurchaseDay: s.card.closingDay
      ? bestPurchaseDate(s.card.closingDay, month).getUTCDate()
      : null,
  }))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Cartões</h1>
        <NewCardDialog />
      </div>
      <CardGoalPanel
        month={monthKeyFromDate(month)}
        goal={goal?.toNumber() ?? null}
        spent={combinedTotal.toNumber()}
        remaining={progress.remaining.toNumber()}
        perDay={progress.perDay.toNumber()}
        daysLeft={progress.daysLeft}
      />
      <CardList cards={cards} />
    </div>
  )
}
