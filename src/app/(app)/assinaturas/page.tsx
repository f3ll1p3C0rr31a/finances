import { requireUserId } from "@/lib/session"
import { listSubscriptions } from "@/lib/actions/subscriptions"
import { listTags } from "@/lib/actions/tags"
import { prisma } from "@/lib/prisma"
import type { SerializedSubscription } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SubscriptionList } from "@/components/subscriptions/subscription-list"
import { NewSubscriptionDialog } from "@/components/subscriptions/new-subscription-dialog"

export default async function AssinaturasPage() {
  const userId = await requireUserId()
  const [subscriptions, cards, tags] = await Promise.all([
    listSubscriptions(userId),
    prisma.card.findMany({ where: { userId, active: true }, orderBy: { name: "asc" } }),
    listTags(userId),
  ])

  const serialized: SerializedSubscription[] = subscriptions.map((s) => ({
    id: s.id,
    name: s.name,
    amount: s.amount.toNumber(),
    paymentMethod: s.paymentMethod,
    cardId: s.cardId,
    cardName: s.card?.name ?? null,
    active: s.active,
    startMonth: s.startMonth.toISOString(),
    cancelledMonth: s.cancelledMonth ? s.cancelledMonth.toISOString() : null,
    tags: s.tags.map((t) => ({ id: t.tag.id, name: t.tag.name })),
  }))

  const active = serialized.filter((s) => s.active)
  const cancelled = serialized.filter((s) => !s.active)

  const cardOptions = cards.map((c) => ({ id: c.id, name: c.name }))
  const tagOptions = tags.map((t) => ({ id: t.id, name: t.name }))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Assinaturas</h1>
        <NewSubscriptionDialog cards={cardOptions} allTags={tagOptions} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ativas</CardTitle>
        </CardHeader>
        <CardContent>
          <SubscriptionList subscriptions={active} cards={cardOptions} allTags={tagOptions} />
        </CardContent>
      </Card>

      {cancelled.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Canceladas</CardTitle>
          </CardHeader>
          <CardContent>
            <SubscriptionList subscriptions={cancelled} cards={cardOptions} allTags={tagOptions} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
