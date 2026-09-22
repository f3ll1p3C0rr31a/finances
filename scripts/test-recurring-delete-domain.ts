/**
 * Exclusão de lançamento recorrente: escopo e, principalmente, permanência.
 *
 * O bug que originou este arquivo: excluir uma entrada recorrente apagava só a
 * ocorrência do mês; o template seguia ativo e `ensureMonthGenerated()` recriava
 * a linha no carregamento seguinte, então o botão parecia não funcionar. Por
 * isso cada caso aqui materializa o mês de novo depois de excluir e confere que
 * o lançamento não voltou.
 */
import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient, Prisma } from "../src/generated/prisma/client"
import { ensureMonthGenerated } from "../src/lib/actions/monthly"
import { deleteIncomeForUser } from "../src/lib/services/deleteIncome"
import { deleteExpenseForUser } from "../src/lib/services/deleteExpense"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

function utc(y: number, m: number, d = 1) {
  return new Date(Date.UTC(y, m - 1, d))
}

function assertEqual(actual: unknown, expected: unknown, label: string) {
  const a = actual instanceof Date ? actual.toISOString().slice(0, 10) : String(actual)
  const e = expected instanceof Date ? expected.toISOString().slice(0, 10) : String(expected)
  if (a !== e) throw new Error(`FALHOU: ${label} — esperado ${e}, obtido ${a}`)
  console.log(`ok: ${label} = ${a}`)
}

const MONTHS = Array.from({ length: 12 }, (_, i) => utc(2026, i + 1))

async function materializeYear(userId: string) {
  for (const month of MONTHS) {
    await ensureMonthGenerated(userId, month)
  }
}

async function incomeMonths(userId: string, templateId: string) {
  const rows = await prisma.incomeEntry.findMany({
    where: { userId, templateId },
    orderBy: { month: "asc" },
    select: { month: true },
  })
  return rows.map((r) => r.month.toISOString().slice(0, 7)).join(",")
}

async function expenseMonths(userId: string, templateId: string) {
  const rows = await prisma.expenseEntry.findMany({
    where: { userId, templateId },
    orderBy: { month: "asc" },
    select: { month: true },
  })
  return rows.map((r) => r.month.toISOString().slice(0, 7)).join(",")
}

async function run() {
  const user = await prisma.user.create({
    data: { email: `teste-delete-${Date.now()}@local`, passwordHash: "x" },
  })

  try {
    console.log("\n== entrada recorrente: este mês e os seguintes ==")
    const aluguel = await prisma.incomeTemplate.create({
      data: {
        userId: user.id,
        name: "Aluguel",
        defaultAmount: new Prisma.Decimal(5000),
        dayOfMonth: 10,
        startMonth: utc(2026, 1),
      },
    })
    await materializeYear(user.id)
    assertEqual(
      (await prisma.incomeEntry.count({ where: { userId: user.id, templateId: aluguel.id } })),
      12,
      "12 meses materializados"
    )

    const november = await prisma.incomeEntry.findFirstOrThrow({
      where: { userId: user.id, templateId: aluguel.id, month: utc(2026, 11) },
    })
    const result = await deleteIncomeForUser(user.id, november.id, "THIS_AND_FUTURE")
    assertEqual(result.deletedEntries, 2, "novembro e dezembro removidos")
    assertEqual(
      await incomeMonths(user.id, aluguel.id),
      "2026-01,2026-02,2026-03,2026-04,2026-05,2026-06,2026-07,2026-08,2026-09,2026-10",
      "sobram janeiro..outubro"
    )
    assertEqual(
      (await prisma.incomeTemplate.findUniqueOrThrow({ where: { id: aluguel.id } })).endMonth,
      utc(2026, 10),
      "template encerrado em outubro"
    )

    // O ponto do bug: materializar de novo não pode ressuscitar nada.
    await materializeYear(user.id)
    assertEqual(
      await incomeMonths(user.id, aluguel.id),
      "2026-01,2026-02,2026-03,2026-04,2026-05,2026-06,2026-07,2026-08,2026-09,2026-10",
      "após remontar o ano, novembro/dezembro seguem apagados"
    )

    console.log("\n== entrada recorrente: apenas este mês ==")
    const marco = await prisma.incomeEntry.findFirstOrThrow({
      where: { userId: user.id, templateId: aluguel.id, month: utc(2026, 3) },
    })
    await deleteIncomeForUser(user.id, marco.id, "ONLY_THIS")
    await materializeYear(user.id)
    assertEqual(
      await incomeMonths(user.id, aluguel.id),
      "2026-01,2026-02,2026-04,2026-05,2026-06,2026-07,2026-08,2026-09,2026-10",
      "março some e não volta; os outros meses ficam"
    )

    console.log("\n== excluir desde o primeiro mês apaga a recorrência inteira ==")
    const janeiro = await prisma.incomeEntry.findFirstOrThrow({
      where: { userId: user.id, templateId: aluguel.id, month: utc(2026, 1) },
    })
    await deleteIncomeForUser(user.id, janeiro.id, "THIS_AND_FUTURE")
    assertEqual(
      await prisma.incomeTemplate.findUnique({ where: { id: aluguel.id } }),
      null,
      "template removido por não sobrar nenhum mês"
    )
    await materializeYear(user.id)
    assertEqual(
      await prisma.incomeEntry.count({ where: { userId: user.id } }),
      0,
      "nenhuma entrada ressuscitada"
    )

    console.log("\n== saldo real devolve o que já tinha sido recebido ==")
    const salario = await prisma.incomeTemplate.create({
      data: {
        userId: user.id,
        name: "Salário",
        defaultAmount: new Prisma.Decimal(1000),
        dayOfMonth: 5,
        startMonth: utc(2026, 1),
      },
    })
    await materializeYear(user.id)
    const junho = await prisma.incomeEntry.findFirstOrThrow({
      where: { userId: user.id, templateId: salario.id, month: utc(2026, 6) },
    })
    await prisma.incomeEntry.update({
      where: { id: junho.id },
      data: { received: true, receivedAt: new Date() },
    })
    await prisma.monthlyBalance.update({
      where: { userId_month: { userId: user.id, month: utc(2026, 6) } },
      data: { actualBalance: new Prisma.Decimal(1000) },
    })
    await deleteIncomeForUser(user.id, junho.id, "ONLY_THIS")
    assertEqual(
      (await prisma.monthlyBalance.findUniqueOrThrow({
        where: { userId_month: { userId: user.id, month: utc(2026, 6) } },
      })).actualBalance,
      "0",
      "recebimento apagado sai do saldo atual"
    )

    console.log("\n== despesa recorrente ==")
    const luz = await prisma.expenseTemplate.create({
      data: {
        userId: user.id,
        name: "Luz",
        category: "FIXED",
        defaultAmount: new Prisma.Decimal(300),
        dayOfMonth: 20,
        startMonth: utc(2026, 1),
      },
    })
    await materializeYear(user.id)
    const setembro = await prisma.expenseEntry.findFirstOrThrow({
      where: { userId: user.id, templateId: luz.id, month: utc(2026, 9) },
    })
    await deleteExpenseForUser(user.id, setembro.id, "ONLY_THIS")
    await materializeYear(user.id)
    assertEqual(
      await expenseMonths(user.id, luz.id),
      "2026-01,2026-02,2026-03,2026-04,2026-05,2026-06,2026-07,2026-08,2026-10,2026-11,2026-12",
      "setembro some e não volta"
    )

    const julho = await prisma.expenseEntry.findFirstOrThrow({
      where: { userId: user.id, templateId: luz.id, month: utc(2026, 7) },
    })
    await deleteExpenseForUser(user.id, julho.id, "THIS_AND_FUTURE")
    await materializeYear(user.id)
    assertEqual(
      await expenseMonths(user.id, luz.id),
      "2026-01,2026-02,2026-03,2026-04,2026-05,2026-06",
      "julho em diante some; o histórico de janeiro a junho fica"
    )
  } finally {
    await prisma.user.delete({ where: { id: user.id } })
  }
}

run()
  .then(() => console.log("\nTodos os testes passaram."))
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
