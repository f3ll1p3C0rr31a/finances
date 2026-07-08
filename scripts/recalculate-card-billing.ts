import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "../src/generated/prisma/client"
import { rematerializeCardPurchaseSchedules } from "../src/lib/services/cardSchedule"
import { recalcOpeningBalanceChain } from "../src/lib/actions/monthly"
import { addMonths } from "../src/lib/calculations/month"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

/**
 * One-shot data fix: reapplies invoiceMonthForPurchase() to every existing
 * purchase after the billing-cycle rule started considering paymentDay
 * (cards whose invoice is due in the same month it closes, like Nubank,
 * were landing purchases one month too late). Idempotent — safe to rerun.
 *
 *   npx tsx scripts/recalculate-card-billing.ts
 */
async function main() {
  const cards = await prisma.card.findMany({
    where: { closingDay: { not: null } },
    include: { user: { select: { id: true, email: true } } },
  })

  const earliestByUser = new Map<string, Date>()

  for (const card of cards) {
    const affectedMonths = await prisma.$transaction((tx) =>
      rematerializeCardPurchaseSchedules(tx, card.id, card)
    )
    if (affectedMonths.length === 0) {
      console.log(`${card.user.email} · ${card.name}: sem compras`)
      continue
    }
    const earliest = affectedMonths.reduce((min, month) => (month < min ? month : min))
    const current = earliestByUser.get(card.userId)
    if (!current || earliest < current) earliestByUser.set(card.userId, earliest)
    console.log(
      `${card.user.email} · ${card.name}: ${affectedMonths.length / 2} compras realinhadas (a partir de ${earliest.toISOString().slice(0, 7)})`
    )
  }

  for (const [userId, earliest] of earliestByUser) {
    await recalcOpeningBalanceChain(userId, addMonths(earliest, -1))
    await recalcOpeningBalanceChain(userId, earliest)
    console.log(`Cadeia de saldos recalculada para o usuário ${userId}`)
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
