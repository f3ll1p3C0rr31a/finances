"use server"

import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"
import { revalidatePath } from "next/cache"
import { monthKeyFromDate, dateWithDay } from "@/lib/calculations/month"
import { expenseEntrySchema, type ExpenseEntryInput } from "@/lib/validation/schemas"

function revalidateMonth(month: Date) {
  revalidatePath(`/cashflow/${monthKeyFromDate(month)}`)
}

export async function createExpenseEntry(month: Date, input: ExpenseEntryInput) {
  const userId = await requireUserId()
  const data = expenseEntrySchema.parse(input)
  const dueDate = data.dueDay ? dateWithDay(month, data.dueDay) : null
  const paidByName = data.paidBy === "THIRD_PARTY" ? data.paidByName ?? null : null

  if (data.recurring && data.category !== "ONE_OFF") {
    const template = await prisma.expenseTemplate.create({
      data: {
        userId,
        name: data.name,
        category: data.category,
        defaultAmount: data.amount,
        dayOfMonth: data.dueDay ?? null,
        startMonth: month,
      },
    })
    await prisma.expenseEntry.create({
      data: {
        userId,
        templateId: template.id,
        name: data.name,
        category: data.category,
        month,
        dueDate,
        amount: data.amount,
        paidBy: data.paidBy,
        paidByName,
      },
    })
  } else {
    await prisma.expenseEntry.create({
      data: {
        userId,
        name: data.name,
        category: data.category,
        month,
        dueDate,
        amount: data.amount,
        paidBy: data.paidBy,
        paidByName,
      },
    })
  }

  revalidateMonth(month)
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
      dueDate: data.dueDay ? dateWithDay(existing.month, data.dueDay) : null,
      paidBy: data.paidBy,
      paidByName,
    },
  })

  revalidateMonth(entry.month)
}

export async function setExpensePaid(id: string, paid: boolean) {
  const userId = await requireUserId()
  const entry = await prisma.expenseEntry.update({
    where: { id, userId },
    data: {
      paid,
      paidAt: paid ? new Date() : null,
    },
  })
  revalidateMonth(entry.month)
}

export async function deleteExpenseEntry(id: string) {
  const userId = await requireUserId()
  const entry = await prisma.expenseEntry.delete({ where: { id, userId } })
  revalidateMonth(entry.month)
}
