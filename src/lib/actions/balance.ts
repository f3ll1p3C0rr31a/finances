"use server"

import { revalidatePath } from "next/cache"

import { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"
import { monthKeyFromDate } from "@/lib/calculations/month"
import { recalcOpeningBalanceChain } from "@/lib/actions/monthly"

export async function setActualBalance(month: Date, amount: number | null) {
  const userId = await requireUserId()
  const decimalAmount = amount == null ? null : new Prisma.Decimal(amount)

  await prisma.monthlyBalance.update({
    where: { userId_month: { userId, month } },
    data: {
      actualBalance: decimalAmount,
      actualBalanceAt: decimalAmount ? new Date() : null,
    },
  })

  await recalcOpeningBalanceChain(userId, month)

  revalidatePath(`/dashboard/${monthKeyFromDate(month)}`)
}
