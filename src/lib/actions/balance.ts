"use server"

import { revalidatePath } from "next/cache"

import { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"
import { monthKeyFromDate } from "@/lib/calculations/month"
import { recalcOpeningBalanceChain } from "@/lib/actions/monthly"

/**
 * Sets a month's real balance for a user without requiring an HTTP session,
 * so background work (e.g. the Pluggy sync) can reuse the same rule as the
 * user-facing action.
 */
export async function setActualBalanceForUser(
  userId: string,
  month: Date,
  amount: Prisma.Decimal | null
): Promise<void> {
  await prisma.monthlyBalance.update({
    where: { userId_month: { userId, month } },
    data: {
      actualBalance: amount,
      actualBalanceAt: amount ? new Date() : null,
    },
  })

  await recalcOpeningBalanceChain(userId, month)
}

export async function setActualBalance(month: Date, amount: number | null) {
  const userId = await requireUserId()
  await setActualBalanceForUser(
    userId,
    month,
    amount == null ? null : new Prisma.Decimal(amount)
  )

  revalidatePath(`/dashboard/${monthKeyFromDate(month)}`)
}
