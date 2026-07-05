"use server"

import { revalidatePath } from "next/cache"

import { requireUserId } from "@/lib/session"
import { monthKeyFromDate } from "@/lib/calculations/month"
import { setCardInvoicePaidForUser } from "@/lib/services/cardInvoicePayment"

export async function setCardInvoicePaid(cardId: string, month: Date, paid: boolean) {
  const userId = await requireUserId()
  await setCardInvoicePaidForUser(userId, cardId, month, paid)
  revalidatePath(`/dashboard/${monthKeyFromDate(month)}`)
}
