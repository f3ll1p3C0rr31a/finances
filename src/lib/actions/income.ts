"use server"

import { revalidatePath } from "next/cache"

import { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"
import { currentMonth, monthKeyFromDate } from "@/lib/calculations/month"
import { resolveDueDate } from "@/lib/calculations/businessDay"
import { adjustActualBalance, recalcOpeningBalanceChain } from "@/lib/actions/monthly"
import { incomeEntrySchema, type IncomeEntryInput } from "@/lib/validation/schemas"

function revalidateMonth(month: Date) {
  revalidatePath(`/dashboard/${monthKeyFromDate(month)}`)
}

export async function createIncomeEntry(month: Date, input: IncomeEntryInput) {
  const userId = await requireUserId()
  const data = incomeEntrySchema.parse(input)
  const entryMonth = data.uncertain ? currentMonth() : month
  const dueDate =
    !data.uncertain && data.dueDay
      ? resolveDueDate(entryMonth, data.dueDayType, data.dueDay)
      : null

  let entryId: string

  if (data.recurring && !data.uncertain) {
    const template = await prisma.incomeTemplate.create({
      data: {
        userId,
        name: data.name,
        defaultAmount: data.amount,
        dayOfMonth: data.dueDay ?? null,
        dueDayType: data.dueDayType,
        startMonth: entryMonth,
      },
    })
    const entry = await prisma.incomeEntry.create({
      data: {
        userId,
        templateId: template.id,
        name: data.name,
        month: entryMonth,
        dueDate,
        dueDayType: data.dueDayType,
        dueDayValue: data.dueDay ?? null,
        amount: data.amount,
      },
    })
    entryId = entry.id
  } else {
    const entry = await prisma.incomeEntry.create({
      data: {
        userId,
        name: data.name,
        month: entryMonth,
        dueDate,
        dueDayType: data.dueDayType,
        dueDayValue: data.dueDay ?? null,
        amount: data.amount,
        uncertain: data.uncertain,
      },
    })
    entryId = entry.id
  }

  revalidateMonth(entryMonth)
  return { id: entryId }
}

export async function updateIncomeEntry(id: string, input: IncomeEntryInput) {
  const userId = await requireUserId()
  const data = incomeEntrySchema.parse(input)

  const existing = await prisma.incomeEntry.findUniqueOrThrow({ where: { id, userId } })
  if (existing.templateId && data.uncertain) {
    throw new Error("A recurring income cannot become uncertain")
  }

  const entry = await prisma.incomeEntry.update({
    where: { id, userId },
    data: {
      name: data.name,
      amount: data.amount,
      dueDayType: data.dueDayType,
      dueDayValue: data.uncertain ? null : data.dueDay ?? null,
      dueDate:
        !data.uncertain && data.dueDay
          ? resolveDueDate(existing.month, data.dueDayType, data.dueDay)
          : null,
      uncertain: data.uncertain,
    },
  })

  // If the amount changed while already marked received, keep the real
  // balance consistent with the new amount.
  if (existing.received && !existing.amount.equals(data.amount)) {
    await adjustActualBalance(userId, entry.month, new Prisma.Decimal(data.amount).sub(existing.amount))
  }

  revalidateMonth(entry.month)
}

export async function setIncomeReceived(id: string, received: boolean) {
  const userId = await requireUserId()
  const existing = await prisma.incomeEntry.findUniqueOrThrow({ where: { id, userId } })
  if (existing.received === received) return

  const entry = await prisma.incomeEntry.update({
    where: { id, userId },
    data: {
      received,
      receivedAt: received ? new Date() : null,
    },
  })

  const amount = entry.receivedAmount ?? entry.amount
  await adjustActualBalance(userId, entry.month, received ? amount : amount.neg())
  if (entry.uncertain) {
    await recalcOpeningBalanceChain(userId, entry.month)
  }

  revalidateMonth(entry.month)
}

export async function deleteIncomeEntry(id: string) {
  const userId = await requireUserId()
  const entry = await prisma.incomeEntry.delete({ where: { id, userId } })
  if (entry.received) {
    const amount = entry.receivedAmount ?? entry.amount
    await adjustActualBalance(userId, entry.month, amount.neg())
  }
  revalidateMonth(entry.month)
}
