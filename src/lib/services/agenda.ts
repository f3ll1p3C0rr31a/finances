import { prisma } from "@/lib/prisma"
import { currentMonth, dateWithDay, today } from "@/lib/calculations/month"
import { getCardMonthTotal } from "@/lib/actions/cardSummary"
import { ensureSubscriptionChargesGenerated } from "@/lib/services/subscriptionCharges"

/**
 * O que vence hoje e o que já venceu sem ser pago — a fonte das notificações
 * do app.
 *
 * Vencidos entram junto porque a notificação de "hoje" só serve se você a vir
 * hoje; um boleto que passou continua precisando de aviso até ser marcado.
 *
 * Conta de terceiro aparece marcada: ela não entra no seu saldo, mas o
 * lembrete continua útil, porque em geral é você quem repassa ou cobra.
 */
export type AgendaItem = {
  kind: "income" | "expense" | "card" | "subscription"
  id: string
  title: string
  amount: number
  dueDate: string
  overdue: boolean
  thirdParty: boolean
}

export async function getAgenda(userId: string): Promise<{ date: string; items: AgendaItem[] }> {
  const day = today()
  const month = currentMonth()
  await ensureSubscriptionChargesGenerated(userId)

  const [incomes, expenses, cards, charges] = await Promise.all([
    prisma.incomeEntry.findMany({
      where: { userId, month, received: false, dueDate: { not: null, lte: day } },
    }),
    prisma.expenseEntry.findMany({
      where: { userId, month, paid: false, dueDate: { not: null, lte: day } },
    }),
    prisma.card.findMany({
      where: { userId, active: true, paymentDay: { not: null } },
      include: { invoicePayments: { where: { month }, take: 1 } },
    }),
    prisma.subscriptionCharge.findMany({
      where: { subscription: { userId }, chargeDate: day },
      include: { subscription: { select: { name: true } } },
    }),
  ])

  const items: AgendaItem[] = []

  for (const income of incomes) {
    items.push({
      kind: "income",
      id: income.id,
      title: income.name,
      amount: income.amount.toNumber(),
      dueDate: income.dueDate!.toISOString().slice(0, 10),
      overdue: income.dueDate! < day,
      thirdParty: false,
    })
  }

  for (const expense of expenses) {
    items.push({
      kind: "expense",
      id: expense.id,
      title: expense.name,
      amount: expense.amount.toNumber(),
      dueDate: expense.dueDate!.toISOString().slice(0, 10),
      overdue: expense.dueDate! < day,
      thirdParty: expense.paidBy === "THIRD_PARTY",
    })
  }

  for (const card of cards) {
    if (card.invoicePayments[0]?.paid) continue
    const due = dateWithDay(month, card.paymentDay!)
    if (due > day) continue
    const total = await getCardMonthTotal(userId, card.id, month, card)
    if (total.lessThanOrEqualTo(0)) continue
    items.push({
      kind: "card",
      id: card.id,
      title: `Fatura ${card.name}`,
      amount: total.toNumber(),
      dueDate: due.toISOString().slice(0, 10),
      overdue: due < day,
      thirdParty: false,
    })
  }

  for (const charge of charges) {
    items.push({
      kind: "subscription",
      id: charge.id,
      title: charge.subscription.name,
      amount: charge.amount.toNumber(),
      dueDate: charge.chargeDate.toISOString().slice(0, 10),
      overdue: false,
      thirdParty: false,
    })
  }

  items.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title))

  return { date: day.toISOString().slice(0, 10), items }
}
