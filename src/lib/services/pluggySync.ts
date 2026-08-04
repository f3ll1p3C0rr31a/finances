import { Prisma } from "@/generated/prisma/client"

import { prisma } from "@/lib/prisma"
import { addMonths, currentMonth } from "@/lib/calculations/month"
import { invoiceMonthForPurchase } from "@/lib/calculations/cardTiming"
import { ensureMonthGenerated, recalcOpeningBalanceChain } from "@/lib/actions/monthly"
import { setActualBalanceForUser } from "@/lib/actions/balance"
import {
  getItem,
  listAccounts,
  listTransactionsSince,
  type PluggyTransaction,
} from "@/lib/services/pluggyClient"

export type SyncResult = {
  expenses: number
  incomes: number
  cardPurchases: number
  skipped: number
}

function monthOf(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function dateOnly(iso: string): Date {
  const parsed = new Date(iso)
  return new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate())
  )
}

/**
 * Pluggy gives a free-text description; this maps the common Brazilian
 * wording to the app's payment methods so imported expenses land in the
 * right bucket of the "gastos por etiqueta" filter.
 */
function inferPaymentMethod(description: string): "PIX" | "BOLETO" | "TRANSFER" | "CASH" | "OTHER" {
  const text = description.toLowerCase()
  if (text.includes("pix")) return "PIX"
  if (text.includes("boleto")) return "BOLETO"
  if (/\bted\b|\bdoc\b|transfer/.test(text)) return "TRANSFER"
  if (text.includes("saque") || text.includes("dinheiro")) return "CASH"
  return "OTHER"
}

function describeInstallment(transaction: PluggyTransaction): string {
  const meta = transaction.creditCardMetadata
  if (meta?.installmentNumber && meta.totalInstallments && meta.totalInstallments > 1) {
    return `${transaction.description} (${meta.installmentNumber}/${meta.totalInstallments})`
  }
  return transaction.description
}

type LinkWithRelations = Prisma.PluggyAccountLinkGetPayload<{
  include: { card: true; connection: true }
}>

/**
 * Imported entries are written directly instead of going through
 * setExpensePaid/setIncomeReceived on purpose: those adjust actualBalance by
 * delta, and this sync overwrites actualBalance with the bank's real balance
 * at the end. Using both would double-count.
 */
async function importTransaction(
  link: LinkWithRelations,
  userId: string,
  transaction: PluggyTransaction,
  affectedMonths: Set<number>
): Promise<keyof SyncResult> {
  const amount = new Prisma.Decimal(Math.abs(transaction.amount)).toDecimalPlaces(2)
  const transactionDate = dateOnly(transaction.date)
  const calendarMonth = monthOf(transactionDate)

  if (link.type === "CREDIT") {
    if (!link.card) return "skipped"
    // Credit-card refunds/payments arrive as CREDIT; they are not purchases.
    if (transaction.type === "CREDIT") return "skipped"

    const billingMonth = invoiceMonthForPurchase(link.card, transactionDate)
    const purchase = await prisma.cardPurchase.create({
      data: {
        cardId: link.card.id,
        description: describeInstallment(transaction),
        totalAmount: amount,
        purchaseDate: transactionDate,
        billingMonth,
        // Pluggy already emits one transaction per installment/month, so each
        // one is stored as its own single-payment purchase.
        installmentCount: 1,
      },
    })
    await prisma.pluggyImportedTransaction.create({
      data: {
        accountLinkId: link.id,
        pluggyTransactionId: transaction.id,
        targetType: "CARD_PURCHASE",
        targetId: purchase.id,
        amount,
        description: transaction.description,
        transactionDate,
      },
    })
    affectedMonths.add(billingMonth.getTime())
    return "cardPurchases"
  }

  await ensureMonthGenerated(userId, calendarMonth)

  if (transaction.type === "CREDIT") {
    const entry = await prisma.incomeEntry.create({
      data: {
        userId,
        name: transaction.description,
        month: calendarMonth,
        dueDate: transactionDate,
        amount,
        received: true,
        receivedAt: transactionDate,
        receivedAmount: amount,
      },
    })
    await prisma.pluggyImportedTransaction.create({
      data: {
        accountLinkId: link.id,
        pluggyTransactionId: transaction.id,
        targetType: "INCOME",
        targetId: entry.id,
        amount,
        description: transaction.description,
        transactionDate,
      },
    })
    affectedMonths.add(calendarMonth.getTime())
    return "incomes"
  }

  const entry = await prisma.expenseEntry.create({
    data: {
      userId,
      name: transaction.description,
      category: "VARIABLE",
      month: calendarMonth,
      dueDate: transactionDate,
      amount,
      paid: true,
      paidAt: transactionDate,
      paidAmount: amount,
      paymentMethod: inferPaymentMethod(transaction.description),
    },
  })
  await prisma.pluggyImportedTransaction.create({
    data: {
      accountLinkId: link.id,
      pluggyTransactionId: transaction.id,
      targetType: "EXPENSE",
      targetId: entry.id,
      amount,
      description: transaction.description,
      transactionDate,
    },
  })
  affectedMonths.add(calendarMonth.getTime())
  return "expenses"
}

/**
 * Overwrites the current month's real balance with the sum of every linked
 * bank account marked as counting toward it. Credit-card links are excluded:
 * their debt is already represented by the invoice, not by the balance.
 */
async function applyRealBalance(userId: string): Promise<void> {
  const bankLinks = await prisma.pluggyAccountLink.findMany({
    where: {
      type: "BANK",
      includeInBalance: true,
      accountId: { not: null },
      lastBalance: { not: null },
      connection: { userId },
    },
  })
  if (bankLinks.length === 0) return

  const total = bankLinks.reduce(
    (sum, link) => sum.add(link.lastBalance ?? new Prisma.Decimal(0)),
    new Prisma.Decimal(0)
  )

  const month = currentMonth()
  await ensureMonthGenerated(userId, month)
  await setActualBalanceForUser(userId, month, total)
}

/**
 * Pulls new data for one connection: refreshes each linked account's balance,
 * imports every transaction not yet imported (deduped by Pluggy transaction
 * id), recalculates the balance chain from the earliest affected month, and
 * finally realigns the current month's real balance with the bank.
 */
export async function syncPluggyConnection(connectionId: string): Promise<SyncResult> {
  const connection = await prisma.pluggyConnection.findUniqueOrThrow({
    where: { id: connectionId },
    include: { accountLinks: { include: { card: true, connection: true } } },
  })

  const result: SyncResult = { expenses: 0, incomes: 0, cardPurchases: 0, skipped: 0 }
  const affectedMonths = new Set<number>()

  const item = await getItem(connection.itemId).catch(() => null)
  const accounts = await listAccounts(connection.itemId)

  for (const link of connection.accountLinks) {
    const remoteAccount = accounts.find((account) => account.id === link.pluggyAccountId)
    if (remoteAccount) {
      await prisma.pluggyAccountLink.update({
        where: { id: link.id },
        data: {
          lastBalance: new Prisma.Decimal(remoteAccount.balance).toDecimalPlaces(2),
          lastBalanceAt: new Date(),
          name: remoteAccount.name,
        },
      })
    }

    const isLinked = Boolean(link.accountId ?? link.cardId)
    if (!isLinked) continue

    const transactions = await listTransactionsSince(
      link.pluggyAccountId,
      link.transactionsSyncedAt
    )
    // Oldest first so the balance chain is recalculated from a stable base.
    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    const alreadyImported = await prisma.pluggyImportedTransaction.findMany({
      where: { pluggyTransactionId: { in: transactions.map((t) => t.id) } },
      select: { pluggyTransactionId: true },
    })
    const importedIds = new Set(alreadyImported.map((row) => row.pluggyTransactionId))

    for (const transaction of transactions) {
      if (importedIds.has(transaction.id)) continue
      // Pending transactions can still change amount or vanish; wait for POSTED.
      if (transaction.status === "PENDING") {
        result.skipped++
        continue
      }
      const bucket = await importTransaction(link, connection.userId, transaction, affectedMonths)
      result[bucket]++
    }

    await prisma.pluggyAccountLink.update({
      where: { id: link.id },
      data: { transactionsSyncedAt: new Date() },
    })
  }

  if (affectedMonths.size > 0) {
    const earliest = new Date(Math.min(...affectedMonths))
    await recalcOpeningBalanceChain(connection.userId, addMonths(earliest, -1))
    await recalcOpeningBalanceChain(connection.userId, earliest)
  }

  await applyRealBalance(connection.userId)

  await prisma.pluggyConnection.update({
    where: { id: connection.id },
    data: {
      lastSyncedAt: new Date(),
      status: item?.status ?? connection.status,
      executionStatus: item?.executionStatus ?? connection.executionStatus,
    },
  })

  return result
}
