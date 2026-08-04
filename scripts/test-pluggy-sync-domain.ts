import "dotenv/config"
import Module from "node:module"

import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "../src/generated/prisma/client"
import type { PluggyAccount, PluggyTransaction } from "../src/lib/services/pluggyClient"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

/**
 * Domain test for the Pluggy sync, with the HTTP client stubbed so no real
 * Pluggy call is made. Run with: npx tsx scripts/test-pluggy-sync-domain.ts
 */
const stub = {
  accounts: [] as PluggyAccount[],
  transactions: new Map<string, PluggyTransaction[]>(),
}

// Intercept the pluggyClient module before pluggySync imports it.
type ModuleWithLoad = typeof Module & {
  _load(request: string, parent: unknown, isMain: boolean): unknown
}
const moduleWithLoad = Module as ModuleWithLoad
const originalLoad = moduleWithLoad._load.bind(moduleWithLoad)
moduleWithLoad._load = function patchedLoad(request: string, parent: unknown, isMain: boolean) {
  if (request.includes("pluggyClient")) {
    return {
      pluggyIsConfigured: () => true,
      getItem: async () => ({
        id: "item-1",
        connector: { id: 1, name: "Banco Teste" },
        status: "UPDATED",
        executionStatus: "SUCCESS",
      }),
      listAccounts: async () => stub.accounts,
      listTransactionsSince: async (accountId: string) => stub.transactions.get(accountId) ?? [],
      deleteItem: async () => undefined,
      createConnectToken: async () => "token",
      registerWebhook: async () => undefined,
      listWebhooks: async () => [],
      deleteWebhook: async () => undefined,
    }
  }
  return originalLoad(request, parent, isMain)
}

function utc(y: number, m: number, d = 1) {
  return new Date(Date.UTC(y, m - 1, d))
}

function assertEqual(actual: unknown, expected: unknown, label: string) {
  const a = actual instanceof Date ? actual.toISOString().slice(0, 10) : String(actual)
  const e = expected instanceof Date ? expected.toISOString().slice(0, 10) : String(expected)
  if (a !== e) throw new Error(`FALHOU: ${label} — esperado ${e}, obtido ${a}`)
  console.log(`ok: ${label} = ${a}`)
}

async function main() {
  const { syncPluggyConnection } = await import("../src/lib/services/pluggySync")

  const email = `__pluggy_test_${Date.now()}@test.local`
  const user = await prisma.user.create({ data: { email, passwordHash: "x" } })

  try {
    const account = await prisma.account.create({
      data: { userId: user.id, name: "Conta Teste" },
    })
    const card = await prisma.card.create({
      data: {
        userId: user.id,
        name: "Cartão Teste",
        closingDay: 2,
        paymentDay: 10,
        cardNumber: "4111111111111111",
      },
    })

    const connection = await prisma.pluggyConnection.create({
      data: {
        userId: user.id,
        itemId: "item-1",
        connectorId: 1,
        connectorName: "Banco Teste",
        status: "UPDATED",
        accountLinks: {
          create: [
            {
              pluggyAccountId: "acc-bank",
              type: "BANK",
              name: "Conta Corrente",
              accountId: account.id,
            },
            {
              pluggyAccountId: "acc-card",
              type: "CREDIT",
              name: "Cartão",
              numberLast4: "1111",
              cardId: card.id,
            },
          ],
        },
      },
    })

    stub.accounts = [
      {
        id: "acc-bank",
        type: "BANK",
        subtype: "CHECKING_ACCOUNT",
        name: "Conta Corrente",
        number: "12345",
        balance: 2500.75,
        currencyCode: "BRL",
      },
      {
        id: "acc-card",
        type: "CREDIT",
        subtype: "CREDIT_CARD",
        name: "Cartão",
        number: "1111",
        balance: 300,
        currencyCode: "BRL",
      },
    ]

    stub.transactions.set("acc-bank", [
      {
        id: "tx-debit",
        description: "PIX ENVIADO MERCADO",
        amount: -150.5,
        date: "2026-07-05T10:00:00.000Z",
        type: "DEBIT",
        status: "POSTED",
      },
      {
        id: "tx-credit",
        description: "SALARIO",
        amount: 5000,
        date: "2026-07-05T10:00:00.000Z",
        type: "CREDIT",
        status: "POSTED",
      },
      {
        id: "tx-pending",
        description: "COMPRA PENDENTE",
        amount: -99,
        date: "2026-07-06T10:00:00.000Z",
        type: "DEBIT",
        status: "PENDING",
      },
    ])
    stub.transactions.set("acc-card", [
      {
        id: "tx-card",
        description: "LOJA X",
        amount: -200,
        date: "2026-07-07T10:00:00.000Z",
        type: "DEBIT",
        status: "POSTED",
        creditCardMetadata: { installmentNumber: 2, totalInstallments: 6 },
      },
    ])

    const first = await syncPluggyConnection(connection.id)
    assertEqual(first.expenses, 1, "1 despesa importada")
    assertEqual(first.incomes, 1, "1 entrada importada")
    assertEqual(first.cardPurchases, 1, "1 compra de cartão importada")
    assertEqual(first.skipped, 1, "1 transação PENDING ignorada")

    const expense = await prisma.expenseEntry.findFirstOrThrow({ where: { userId: user.id } })
    assertEqual(expense.amount.toFixed(2), "150.50", "despesa com valor absoluto")
    assertEqual(expense.paid, true, "despesa marcada como paga")
    assertEqual(expense.paymentMethod, "PIX", "método inferido como PIX")
    assertEqual(expense.month, utc(2026, 7), "despesa no mês civil de julho")

    const income = await prisma.incomeEntry.findFirstOrThrow({ where: { userId: user.id } })
    assertEqual(income.received, true, "entrada marcada como recebida")
    assertEqual(income.amount.toFixed(2), "5000.00", "entrada com valor correto")

    const purchase = await prisma.cardPurchase.findFirstOrThrow({ where: { cardId: card.id } })
    assertEqual(purchase.billingMonth!, utc(2026, 8), "compra 07/07 na fatura de agosto")
    assertEqual(purchase.description, "LOJA X (2/6)", "descrição com número da parcela")
    assertEqual(purchase.installmentCount, 1, "cada parcela é uma compra única")

    const balance = await prisma.monthlyBalance.findFirstOrThrow({
      where: { userId: user.id, month: new Date(Date.UTC(
        new Date().getUTCFullYear(), new Date().getUTCMonth(), 1))
      },
    })
    assertEqual(balance.actualBalance!.toFixed(2), "2500.75", "saldo real do mês = saldo do banco")

    // Second sync with the same data must not duplicate anything.
    const second = await syncPluggyConnection(connection.id)
    assertEqual(second.expenses, 0, "resync não duplica despesas")
    assertEqual(second.incomes, 0, "resync não duplica entradas")
    assertEqual(second.cardPurchases, 0, "resync não duplica compras")

    const expenseCount = await prisma.expenseEntry.count({ where: { userId: user.id } })
    assertEqual(expenseCount, 1, "total de despesas continua 1")

    // A previously pending transaction that settles gets imported later.
    stub.transactions.set("acc-bank", [
      {
        id: "tx-pending",
        description: "COMPRA PENDENTE",
        amount: -99,
        date: "2026-07-06T10:00:00.000Z",
        type: "DEBIT",
        status: "POSTED",
      },
    ])
    const third = await syncPluggyConnection(connection.id)
    assertEqual(third.expenses, 1, "transação que saiu de PENDING é importada depois")

    // Deleting an imported entry must not resurrect it on the next sync.
    await prisma.expenseEntry.delete({ where: { id: expense.id } })
    const fourth = await syncPluggyConnection(connection.id)
    assertEqual(fourth.expenses, 0, "lançamento excluído não volta na sincronização")
  } finally {
    await prisma.user.delete({ where: { id: user.id } })
  }
}

main()
  .then(() => console.log("\nTodos os testes passaram."))
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
