import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "../src/generated/prisma/client"
import { recalcOpeningBalanceChain } from "../src/lib/actions/monthly"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

/**
 * Reaplica a regra de saldo herdado (`openingForNextMonth()`) a todos os meses
 * já gravados. Necessário depois de mudar a regra: `recalcOpeningBalanceChain`
 * só roda quando algo é editado, então os meses parados manteriam o valor
 * antigo até alguém mexer neles.
 *
 * Percorre mês a mês em ordem crescente, porque a propagação para no primeiro
 * elo que não muda — e um elo estável pode ser seguido de outro que mudou.
 * Idempotente: rodar de novo não altera nada.
 *
 *   npx tsx scripts/recalculate-balance-chain.ts
 */
async function main() {
  const users = await prisma.user.findMany({ select: { id: true, email: true } })

  for (const user of users) {
    const months = await prisma.monthlyBalance.findMany({
      where: { userId: user.id },
      orderBy: { month: "asc" },
      select: { month: true, openingBalance: true },
    })
    if (months.length === 0) {
      console.log(`${user.email}: nenhum mês materializado`)
      continue
    }

    const before = new Map(months.map((m) => [m.month.toISOString(), m.openingBalance.toFixed(2)]))

    for (const { month } of months) {
      await recalcOpeningBalanceChain(user.id, month)
    }

    const after = await prisma.monthlyBalance.findMany({
      where: { userId: user.id },
      orderBy: { month: "asc" },
      select: { month: true, openingBalance: true },
    })

    let changed = 0
    for (const row of after) {
      const previous = before.get(row.month.toISOString())
      const current = row.openingBalance.toFixed(2)
      if (previous !== current) {
        changed++
        console.log(
          `${user.email} · ${row.month.toISOString().slice(0, 7)}: saldo inicial ${previous} -> ${current}`
        )
      }
    }
    console.log(
      `${user.email}: ${months.length} meses verificados, ${changed} saldo(s) inicial(is) ajustado(s)`
    )
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
