/**
 * Testes puros das regras alteradas em 2026-08-18:
 * saldo planejado a partir do saldo atual e fatura em aberto dos cartões.
 *
 * Roda sem banco: `npx tsx scripts/test-balance-domain.ts`.
 */
import { Prisma } from "../src/generated/prisma/client"
import {
  computeMonthTotals,
  computeOpenCashflow,
  computePlannedBalance,
  computeUncertainPreview,
} from "../src/lib/calculations/balanceChain"
import { openInvoiceMonth } from "../src/lib/calculations/cardTiming"

function utc(y: number, m: number, d = 1) {
  return new Date(Date.UTC(y, m - 1, d))
}

function dec(value: number) {
  return new Prisma.Decimal(value)
}

let failures = 0

function assertEqual(actual: unknown, expected: unknown, label: string) {
  const format = (v: unknown) =>
    v instanceof Date
      ? v.toISOString().slice(0, 10)
      : v instanceof Prisma.Decimal
        ? v.toFixed(2)
        : String(v)
  const a = format(actual)
  const e = format(expected)
  if (a !== e) {
    failures++
    console.error(`FALHOU: ${label} — esperado ${e}, obtido ${a}`)
    return
  }
  console.log(`ok: ${label} = ${a}`)
}

function income(amount: number, opts: { received?: boolean; uncertain?: boolean; receivedAmount?: number } = {}) {
  return {
    amount: dec(amount),
    receivedAmount: opts.receivedAmount == null ? null : dec(opts.receivedAmount),
    received: opts.received ?? false,
    uncertain: opts.uncertain ?? false,
  }
}

function expense(amount: number, opts: { paid?: boolean; uncertain?: boolean; paidAmount?: number } = {}) {
  return {
    amount: dec(amount),
    paidAmount: opts.paidAmount == null ? null : dec(opts.paidAmount),
    paid: opts.paid ?? false,
    uncertain: opts.uncertain ?? false,
  }
}

function plannedBalanceTests() {
  console.log("\n== saldo planejado ==")

  // Mês futuro intocado: nada recebido ou pago, então a regra nova devolve o
  // mesmo que a antiga (saldo inicial + entradas − saídas).
  {
    const incomes = [income(5000), income(1200)]
    const expenses = [expense(800), expense(400)]
    const opening = dec(1000)
    const totals = computeMonthTotals(incomes, expenses)
    const open = computeOpenCashflow(incomes, expenses)
    const planned = computePlannedBalance(opening, open.futureIncome, open.futureExpense)
    const legacy = opening.add(totals.totalIncome).sub(totals.totalExpense)
    assertEqual(planned, legacy, "mês futuro: nova regra == regra antiga")
    assertEqual(planned, dec(6000), "mês futuro: 1000 + 6200 − 1200")
  }

  // O ponto da mudança: o valor recebido divergiu do previsto e o saldo atual
  // já reflete o dinheiro real. Partir do saldo inicial repetiria a diferença.
  {
    const incomes = [income(5000, { received: true, receivedAmount: 4800 }), income(1200)]
    const expenses = [expense(800, { paid: true, paidAmount: 850 }), expense(400)]
    // saldo inicial 1000, recebeu 4800 e pagou 850 -> saldo atual 4950
    const actual = dec(1000).add(dec(4800)).sub(dec(850))
    const open = computeOpenCashflow(incomes, expenses)
    assertEqual(open.futureIncome, dec(1200), "futuras: só a entrada não recebida")
    assertEqual(open.futureExpense, dec(400), "futuras: só a saída não paga")
    const planned = computePlannedBalance(actual, open.futureIncome, open.futureExpense)
    assertEqual(planned, dec(5750), "planejado = 4950 + 1200 − 400")

    const totals = computeMonthTotals(incomes, expenses)
    const legacy = dec(1000).add(totals.totalIncome).sub(totals.totalExpense)
    assertEqual(legacy, dec(5750), "regra antiga coincide quando o saldo atual não foi corrigido à mão")
  }

  // Saldo atual corrigido à mão (tarifa, rendimento, compra esquecida): a
  // regra antiga ignorava a correção, a nova parte dela.
  {
    const incomes = [income(5000, { received: true })]
    const expenses = [expense(400)]
    const correctedActual = dec(5930) // 1000 + 5000 − 70 de tarifas lançadas no banco
    const open = computeOpenCashflow(incomes, expenses)
    const planned = computePlannedBalance(correctedActual, open.futureIncome, open.futureExpense)
    assertEqual(planned, dec(5530), "planejado parte do saldo corrigido: 5930 − 400")
    const totals = computeMonthTotals(incomes, expenses)
    assertEqual(
      dec(1000).add(totals.totalIncome).sub(totals.totalExpense),
      dec(5600),
      "regra antiga perderia os 70 de tarifa"
    )
  }

  // Incertos pendentes ficam fora do planejado e só aparecem na prévia.
  {
    const incomes = [income(2000, { uncertain: true }), income(1000)]
    const expenses = [expense(300, { uncertain: true }), expense(500)]
    const open = computeOpenCashflow(incomes, expenses)
    assertEqual(open.futureIncome, dec(1000), "futuras excluem entrada incerta")
    assertEqual(open.futureExpense, dec(500), "futuras excluem saída incerta")

    const planned = computePlannedBalance(dec(100), open.futureIncome, open.futureExpense)
    assertEqual(planned, dec(600), "planejado ignora incertos")

    const preview = computeUncertainPreview(incomes, expenses)
    assertEqual(planned.add(preview.net), dec(2300), "prévia soma os incertos uma única vez")
  }

  // Incerto já realizado deixa de ser incerto: entra nos totais e no saldo
  // atual, e não pode reaparecer nem nas futuras nem na prévia.
  {
    const incomes = [income(2000, { uncertain: true, received: true })]
    const expenses = [expense(300, { uncertain: true, paid: true })]
    const open = computeOpenCashflow(incomes, expenses)
    assertEqual(open.futureIncome, dec(0), "incerto recebido sai das futuras")
    assertEqual(open.futureExpense, dec(0), "incerto pago sai das futuras")
    const preview = computeUncertainPreview(incomes, expenses)
    assertEqual(preview.net, dec(0), "incerto realizado sai da prévia")
    const totals = computeMonthTotals(incomes, expenses)
    assertEqual(totals.totalIncome, dec(2000), "incerto recebido entra nos totais")
    assertEqual(totals.totalExpense, dec(300), "incerto pago entra nos totais")
  }

  // Mês totalmente liquidado: o planejado é exatamente o saldo atual, que é o
  // saldo herdado pelo mês seguinte.
  {
    const incomes = [income(5000, { received: true })]
    const expenses = [expense(800, { paid: true })]
    const open = computeOpenCashflow(incomes, expenses)
    assertEqual(
      computePlannedBalance(dec(5200), open.futureIncome, open.futureExpense),
      dec(5200),
      "mês liquidado: planejado == saldo atual"
    )
  }
}

function openInvoiceTests() {
  console.log("\n== fatura em aberto ==")

  // Nubank: fecha dia 2, vence dia 10 — paga no mesmo mês em que fecha.
  const nubank = { closingDay: 2, paymentDay: 10 }
  assertEqual(openInvoiceMonth(nubank, utc(2026, 8, 1)), utc(2026, 8), "Nubank em 01/08 (antes de fechar) -> fatura de agosto")
  assertEqual(openInvoiceMonth(nubank, utc(2026, 8, 2)), utc(2026, 8), "Nubank no dia do fechamento -> ainda agosto")
  assertEqual(openInvoiceMonth(nubank, utc(2026, 8, 3)), utc(2026, 9), "Nubank em 03/08 (fechou) -> fatura de setembro")
  assertEqual(openInvoiceMonth(nubank, utc(2026, 8, 18)), utc(2026, 9), "Nubank em 18/08 -> fatura de setembro")
  assertEqual(openInvoiceMonth(nubank, utc(2026, 12, 20)), utc(2027, 1), "Nubank em 20/12 -> vira o ano")

  // Fecha 23, vence dia 1 — paga no mês seguinte ao fechamento.
  const late = { closingDay: 23, paymentDay: 1 }
  assertEqual(openInvoiceMonth(late, utc(2026, 8, 18)), utc(2026, 9), "fecha 23 em 18/08 -> fatura paga em setembro")
  assertEqual(openInvoiceMonth(late, utc(2026, 8, 24)), utc(2026, 10), "fecha 23 em 24/08 (fechou) -> outubro")

  // Fechamento no último dia do mês, em mês curto. O fechamento cai em 28/02 e
  // o vencimento (dia 10) só chega em março, então o mês de faturamento é
  // março — o rótulo do app é sempre o mês em que a fatura é paga.
  const endOfMonth = { closingDay: 31, paymentDay: 10 }
  assertEqual(openInvoiceMonth(endOfMonth, utc(2026, 2, 28)), utc(2026, 3), "fecha 31 (clampado em 28/02) -> fatura paga em março")
  assertEqual(openInvoiceMonth(endOfMonth, utc(2026, 3, 1)), utc(2026, 4), "fecha 31 em 01/03 -> fatura paga em abril")

  // Sem fechamento clássico o cartão fica no mês corrente.
  const noCycle = { closingDay: null, paymentDay: null }
  assertEqual(openInvoiceMonth(noCycle, utc(2026, 8, 18)), utc(2026, 8), "sem fechamento -> mês corrente")
}

plannedBalanceTests()
openInvoiceTests()

if (failures > 0) {
  console.error(`\n${failures} teste(s) falharam.`)
  process.exit(1)
}
console.log("\nTodos os testes passaram.")
