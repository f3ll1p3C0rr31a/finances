import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "../src/generated/prisma/client"
import {
  propagateExpenseTags,
  propagateExpenseTraits,
  propagateIncomeTags,
  propagateIncomeTraits,
} from "../src/lib/services/recurringEntries"
import { currentMonth } from "../src/lib/calculations/month"
import { recalcOpeningBalanceChain } from "../src/lib/actions/monthly"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

/**
 * Empurra as características do mês corrente de cada lançamento recorrente
 * para os meses seguintes já materializados. A herança passou a valer nas
 * edições, mas os meses gravados antes disso continuam com os valores antigos
 * (a van escolar a 400 em setembro depois de virar 600 em agosto, por
 * exemplo). Idempotente.
 *
 *   npx tsx scripts/apply-recurring-inheritance.ts
 */
const month = currentMonth()

function describeExpense(e: { name: string; amount: { toFixed(n: number): string }; paidBy: string; paidByName: string | null }) {
  const quem = e.paidBy === "THIRD_PARTY" ? `terceiro${e.paidByName ? ` (${e.paidByName})` : ""}` : "eu"
  return `${e.name} · ${e.amount.toFixed(2)} · ${quem}`
}

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, email: true } })

  for (const user of users) {
    const expenses = await prisma.expenseEntry.findMany({
      where: { userId: user.id, month, templateId: { not: null } },
      include: { tags: { select: { tagId: true } } },
      orderBy: { name: "asc" },
    })

    for (const entry of expenses) {
      const before = await prisma.expenseEntry.findMany({
        where: { userId: user.id, templateId: entry.templateId, month: { gt: month }, paid: false },
        orderBy: { month: "asc" },
      })
      if (before.length === 0) continue

      await propagateExpenseTraits(user.id, entry)
      await propagateExpenseTags(user.id, entry, entry.tags.map((t) => t.tagId))

      const after = await prisma.expenseEntry.findMany({
        where: { id: { in: before.map((b) => b.id) } },
        orderBy: { month: "asc" },
      })
      const changed = after.filter((row, i) => describeExpense(row) !== describeExpense(before[i]))
      if (changed.length > 0) {
        console.log(
          `${user.email} · despesa "${entry.name}": ${changed.length} mês(es) atualizado(s) -> ${describeExpense(entry)}`
        )
        for (const row of changed) {
          const previous = before.find((b) => b.id === row.id)!
          console.log(
            `    ${row.month.toISOString().slice(0, 7)}: ${describeExpense(previous)}  ->  ${describeExpense(row)}`
          )
        }
      }
    }

    const incomes = await prisma.incomeEntry.findMany({
      where: { userId: user.id, month, templateId: { not: null } },
      include: { tags: { select: { tagId: true } } },
      orderBy: { name: "asc" },
    })

    for (const entry of incomes) {
      const before = await prisma.incomeEntry.findMany({
        where: { userId: user.id, templateId: entry.templateId, month: { gt: month }, received: false },
        orderBy: { month: "asc" },
      })
      if (before.length === 0) continue

      await propagateIncomeTraits(user.id, entry)
      await propagateIncomeTags(user.id, entry, entry.tags.map((t) => t.tagId))

      const after = await prisma.incomeEntry.findMany({
        where: { id: { in: before.map((b) => b.id) } },
        orderBy: { month: "asc" },
      })
      const changed = after.filter(
        (row, i) => row.name !== before[i].name || !row.amount.equals(before[i].amount)
      )
      if (changed.length > 0) {
        console.log(
          `${user.email} · entrada "${entry.name}": ${changed.length} mês(es) atualizado(s) -> ${entry.amount.toFixed(2)}`
        )
      }
    }

    await recalcOpeningBalanceChain(user.id, month)
    console.log(`${user.email}: cadeia de saldos recalculada a partir de ${month.toISOString().slice(0, 7)}`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
