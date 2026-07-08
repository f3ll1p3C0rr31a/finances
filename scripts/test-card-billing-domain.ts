import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient, Prisma } from "../src/generated/prisma/client"
import {
  invoiceMonthForPurchase,
  chargeDateForBillingMonth,
} from "../src/lib/calculations/cardTiming"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

function utc(y: number, m: number, d = 1) {
  return new Date(Date.UTC(y, m - 1, d))
}

function assertEqual(actual: unknown, expected: unknown, label: string) {
  const a = actual instanceof Date ? actual.toISOString().slice(0, 10) : String(actual)
  const e = expected instanceof Date ? expected.toISOString().slice(0, 10) : String(expected)
  if (a !== e) {
    throw new Error(`FALHOU: ${label} — esperado ${e}, obtido ${a}`)
  }
  console.log(`ok: ${label} = ${a}`)
}

async function pureTests() {
  const nubank = { closingDay: 2, paymentDay: 10 }
  assertEqual(invoiceMonthForPurchase(nubank, utc(2026, 7, 7)), utc(2026, 8), "Nubank compra 07/07 -> fatura ago")
  assertEqual(invoiceMonthForPurchase(nubank, utc(2026, 7, 1)), utc(2026, 7), "Nubank compra 01/07 -> fatura jul")
  assertEqual(invoiceMonthForPurchase(nubank, utc(2026, 7, 2)), utc(2026, 7), "Nubank compra 02/07 (fech.) -> fatura jul")
  assertEqual(invoiceMonthForPurchase(nubank, utc(2026, 8, 3)), utc(2026, 9), "Nubank compra 03/08 -> fatura set")

  const late = { closingDay: 23, paymentDay: 1 }
  assertEqual(invoiceMonthForPurchase(late, utc(2026, 7, 20)), utc(2026, 8), "fecha 23/vence 1: 20/07 -> ago")
  assertEqual(invoiceMonthForPurchase(late, utc(2026, 7, 24)), utc(2026, 9), "fecha 23/vence 1: 24/07 -> set")

  const noPayment = { closingDay: 23, paymentDay: null }
  assertEqual(invoiceMonthForPurchase(noPayment, utc(2026, 7, 20)), utc(2026, 8), "sem vencimento: 20/07 -> ago (regra antiga)")
  assertEqual(invoiceMonthForPurchase(noPayment, utc(2026, 7, 24)), utc(2026, 9), "sem vencimento: 24/07 -> set (regra antiga)")

  const mid = { closingDay: 5, paymentDay: 10 }
  assertEqual(invoiceMonthForPurchase(mid, utc(2026, 7, 2)), utc(2026, 7), "fecha 5/vence 10: 02/07 -> jul")
  assertEqual(invoiceMonthForPurchase(mid, utc(2026, 7, 8)), utc(2026, 8), "fecha 5/vence 10: 08/07 -> ago")

  // inversa: para cada ciclo e dia de cobrança, a data devolvida cai na fatura pedida
  for (const cycle of [nubank, late, mid, { closingDay: null, paymentDay: null }]) {
    for (const chargeDay of [1, 2, 8, 15, 28, 31]) {
      for (const billing of [utc(2026, 8), utc(2026, 12), utc(2027, 1)]) {
        const date = chargeDateForBillingMonth(cycle, chargeDay, billing)
        if (!date) throw new Error(`inversa não encontrou data (${JSON.stringify(cycle)} dia ${chargeDay})`)
        assertEqual(
          invoiceMonthForPurchase(cycle, date),
          billing,
          `inversa ciclo=${cycle.closingDay ?? "-"}/${cycle.paymentDay ?? "-"} dia=${chargeDay} fatura=${billing.toISOString().slice(0, 7)}`
        )
      }
    }
  }
}

async function integrationTests() {
  const { ensureSubscriptionChargesGenerated, rematerializeUpcomingSubscriptionCharges } =
    await import("../src/lib/services/subscriptionCharges")
  const { rematerializeCardPurchaseSchedules } = await import("../src/lib/services/cardSchedule")
  const { getCardMonthTotal } = await import("../src/lib/actions/cardSummary")
  const { getCardSubscriptionChargesForMonth, getNonCardSubscriptionsForMonth } = await import(
    "../src/lib/actions/subscriptionSummary"
  )

  const email = `__domain_test_${Date.now()}@test.local`
  const user = await prisma.user.create({ data: { email, passwordHash: "x" } })

  try {
    const card = await prisma.card.create({
      data: { userId: user.id, name: "Nubank Teste", closingDay: 2, paymentDay: 10 },
    })

    // 1. compra antiga com billingMonth errado (regra antiga: 07/07 -> set) é corrigida para ago
    const purchase = await prisma.cardPurchase.create({
      data: {
        cardId: card.id,
        description: "Compra teste",
        totalAmount: new Prisma.Decimal(100),
        purchaseDate: utc(2026, 7, 7),
        billingMonth: utc(2026, 9),
        installmentCount: 1,
      },
    })
    await prisma.$transaction((tx) => rematerializeCardPurchaseSchedules(tx, card.id, card))
    const fixed = await prisma.cardPurchase.findUniqueOrThrow({ where: { id: purchase.id } })
    assertEqual(fixed.billingMonth!, utc(2026, 8), "rematerialização corrige compra 07/07 set->ago")

    // 2. assinatura em cartão: cobrança dia 8 materializa em jul e cai na fatura de ago
    const sub = await prisma.subscription.create({
      data: {
        userId: user.id,
        name: "Evolve Teste",
        amount: new Prisma.Decimal(179.88),
        paymentMethod: "CARD",
        cardId: card.id,
        chargeDay: 8,
        startMonth: utc(2026, 7),
      },
    })
    await ensureSubscriptionChargesGenerated(user.id)
    const charge = await prisma.subscriptionCharge.findUniqueOrThrow({
      where: { subscriptionId_month: { subscriptionId: sub.id, month: utc(2026, 7) } },
    })
    assertEqual(charge.chargeDate, utc(2026, 7, 8), "cobrança materializada em 08/07")
    assertEqual(charge.billingMonth, utc(2026, 8), "cobrança 08/07 na fatura de agosto")

    const augTotal = await getCardMonthTotal(user.id, card.id, utc(2026, 8), card)
    assertEqual(augTotal.toFixed(2), "279.88", "fatura ago = compra 100 + assinatura 179.88")

    const julTotal = await getCardMonthTotal(user.id, card.id, utc(2026, 7), card)
    assertEqual(julTotal.toFixed(2), "0.00", "fatura jul vazia")

    // projeção: setembro ainda mostra a assinatura ativa (cobrança futura 08/08)
    const sepItems = await getCardSubscriptionChargesForMonth(user.id, card.id, utc(2026, 9), card)
    assertEqual(sepItems.length, 1, "projeção de setembro tem 1 cobrança")
    assertEqual(sepItems[0].materialized, false, "cobrança de setembro é projetada")

    // 3. cancelamento hoje (2026-07-08): mantém cobrança de 08/07, corta 08/08 em diante
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { active: false, cancelledAt: utc(2026, 7, 8) },
    })
    const sepAfterCancel = await getCardSubscriptionChargesForMonth(user.id, card.id, utc(2026, 9), card)
    assertEqual(sepAfterCancel.length, 0, "após cancelar, setembro sem cobrança")
    const augAfterCancel = await getCardMonthTotal(user.id, card.id, utc(2026, 8), card)
    assertEqual(augAfterCancel.toFixed(2), "279.88", "após cancelar, cobrança já registrada permanece em ago")

    // 4. edição de dia de cobrança rematerializa o mês corrente
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { active: true, cancelledAt: null, chargeDay: 1 },
    })
    await rematerializeUpcomingSubscriptionCharges(sub.id)
    const july = await prisma.subscriptionCharge.findUniqueOrThrow({
      where: { subscriptionId_month: { subscriptionId: sub.id, month: utc(2026, 7) } },
    })
    assertEqual(july.chargeDate, utc(2026, 7, 1), "edição do dia refaz cobrança do mês corrente (01/07)")
    assertEqual(july.billingMonth, utc(2026, 7), "cobrança 01/07 cai na fatura de julho")

    // 5. assinatura fora de cartão conta no próprio mês civil
    const pixSub = await prisma.subscription.create({
      data: {
        userId: user.id,
        name: "Assinatura Pix",
        amount: new Prisma.Decimal(30),
        paymentMethod: "PIX",
        chargeDay: 5,
        startMonth: utc(2026, 7),
      },
    })
    await ensureSubscriptionChargesGenerated(user.id)
    const julyNonCard = await getNonCardSubscriptionsForMonth(user.id, utc(2026, 7))
    assertEqual(julyNonCard.length, 1, "assinatura fora de cartão aparece em julho")
    assertEqual(julyNonCard[0].materialized, true, "cobrança 05/07 já materializada")
    assertEqual(julyNonCard[0].chargeDate, utc(2026, 7, 5), "cobrança fora de cartão em 05/07")
    void pixSub
  } finally {
    await prisma.user.delete({ where: { id: user.id } })
  }
}

async function main() {
  await pureTests()
  await integrationTests()
  console.log("\nTodos os testes passaram.")
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
