"use server"

import { revalidatePath } from "next/cache"

import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"
import { monthKeyFromDate, dateWithDay } from "@/lib/calculations/month"
import { incomeEntrySchema, type IncomeEntryInput } from "@/lib/validation/schemas"

function revalidateMonth(month: Date) {
  revalidatePath(`/cashflow/${monthKeyFromDate(month)}`)
}

export async function createIncomeEntry(month: Date, input: IncomeEntryInput) {
  const userId = await requireUserId()
  const data = incomeEntrySchema.parse(input)
  const dueDate = data.dueDay ? dateWithDay(month, data.dueDay) : null

  if (data.recurring) {
    const template = await prisma.incomeTemplate.create({
      data: {
        userId,
        name: data.name,
        defaultAmount: data.amount,
        dayOfMonth: data.dueDay ?? null,
        startMonth: month,
      },
    })
    await prisma.incomeEntry.create({
      data: {
        userId,
        templateId: template.id,
        name: data.name,
        month,
        dueDate,
        amount: data.amount,
      },
    })
  } else {
    await prisma.incomeEntry.create({
      data: { userId, name: data.name, month, dueDate, amount: data.amount },
    })
  }

  revalidateMonth(month)
}

export async function updateIncomeEntry(id: string, input: IncomeEntryInput) {
  const userId = await requireUserId()
  const data = incomeEntrySchema.parse(input)

  const existing = await prisma.incomeEntry.findUniqueOrThrow({ where: { id, userId } })

  const entry = await prisma.incomeEntry.update({
    where: { id, userId },
    data: {
      name: data.name,
      amount: data.amount,
      dueDate: data.dueDay ? dateWithDay(existing.month, data.dueDay) : null,
    },
  })

  revalidateMonth(entry.month)
}

export async function setIncomeReceived(id: string, received: boolean) {
  const userId = await requireUserId()
  const entry = await prisma.incomeEntry.update({
    where: { id, userId },
    data: {
      received,
      receivedAt: received ? new Date() : null,
    },
  })
  revalidateMonth(entry.month)
}

export async function deleteIncomeEntry(id: string) {
  const userId = await requireUserId()
  const entry = await prisma.incomeEntry.delete({ where: { id, userId } })
  revalidateMonth(entry.month)
}
