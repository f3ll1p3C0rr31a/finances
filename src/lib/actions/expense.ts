"use server"

import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"
import { revalidatePath } from "next/cache"
import { Prisma } from "@/generated/prisma/client"
import { monthKeyFromDate } from "@/lib/calculations/month"
import { resolveDueDate } from "@/lib/calculations/businessDay"
import { adjustActualBalance } from "@/lib/actions/monthly"
import { expenseEntrySchema, type ExpenseEntryInput } from "@/lib/validation/schemas"

function revalidateMonth(month: Date) {
  revalidatePath(`/dashboard/${monthKeyFromDate(month)}`)
}

export async function createExpenseEntry(month: Date, input: ExpenseEntryInput) {
  const userId = await requireUserId()
  const data = expenseEntrySchema.parse(input)
  const dueDate = data.dueDay ? resolveDueDate(month, data.dueDayType, data.dueDay) : null
  const paidByName = data.paidBy === "THIRD_PARTY" ? data.paidByName ?? null : null

  let entryId: string

  if (data.recurring && data.category !== "ONE_OFF") {
    const template = await prisma.expenseTemplate.create({
      data: {
        userId,
        name: data.name,
        category: data.category,
        defaultAmount: data.amount,
        dayOfMonth: data.dueDay ?? null,
        dueDayType: data.dueDayType,
        startMonth: month,
      },
    })
    const entry = await prisma.expenseEntry.create({
      data: {
        userId,
        templateId: template.id,
        name: data.name,
        category: data.category,
        month,
        dueDate,
        dueDayType: data.dueDayType,
        dueDayValue: data.dueDay ?? null,
        amount: data.amount,
        paidBy: data.paidBy,
        paidByName,
        paymentMethod: data.paymentMethod,
        pixKeyId: data.pixKeyId ?? null,
      },
    })
    entryId = entry.id
  } else {
    const entry = await prisma.expenseEntry.create({
      data: {
        userId,
        name: data.name,
        category: data.category,
        month,
        dueDate,
        dueDayType: data.dueDayType,
        dueDayValue: data.dueDay ?? null,
        amount: data.amount,
        paidBy: data.paidBy,
        paidByName,
        paymentMethod: data.paymentMethod,
        pixKeyId: data.pixKeyId ?? null,
      },
    })
    entryId = entry.id
  }

  revalidateMonth(month)
  return { id: entryId }
}

export async function updateExpenseEntry(id: string, input: ExpenseEntryInput) {
  const userId = await requireUserId()
  const data = expenseEntrySchema.parse(input)
  const paidByName = data.paidBy === "THIRD_PARTY" ? data.paidByName ?? null : null

  const existing = await prisma.expenseEntry.findUniqueOrThrow({ where: { id, userId } })

  const entry = await prisma.expenseEntry.update({
    where: { id, userId },
    data: {
      name: data.name,
      amount: data.amount,
      category: data.category,
      dueDayType: data.dueDayType,
      dueDayValue: data.dueDay ?? null,
      dueDate: data.dueDay ? resolveDueDate(existing.month, data.dueDayType, data.dueDay) : null,
      paidBy: data.paidBy,
      paidByName,
      paymentMethod: data.paymentMethod,
      pixKeyId: data.pixKeyId ?? null,
    },
  })

  if (existing.paid && !existing.amount.equals(data.amount)) {
    await adjustActualBalance(
      userId,
      entry.month,
      new Prisma.Decimal(data.amount).sub(existing.amount).neg()
    )
  }

  revalidateMonth(entry.month)
}

export async function setExpensePaid(id: string, paid: boolean) {
  const userId = await requireUserId()
  const existing = await prisma.expenseEntry.findUniqueOrThrow({ where: { id, userId } })
  if (existing.paid === paid) return

  const entry = await prisma.expenseEntry.update({
    where: { id, userId },
    data: {
      paid,
      paidAt: paid ? new Date() : null,
    },
  })

  const amount = entry.paidAmount ?? entry.amount
  await adjustActualBalance(userId, entry.month, paid ? amount.neg() : amount)

  revalidateMonth(entry.month)
}

export async function deleteExpenseEntry(id: string) {
  const userId = await requireUserId()
  const entry = await prisma.expenseEntry.delete({ where: { id, userId } })
  if (entry.paid) {
    const amount = entry.paidAmount ?? entry.amount
    await adjustActualBalance(userId, entry.month, amount)
  }
  revalidateMonth(entry.month)
}
