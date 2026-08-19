"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireUserId } from "@/lib/session"
import { createDeviceToken, revokeDeviceToken } from "@/lib/services/deviceTokens"

const nameSchema = z.string().trim().min(1, "Dê um nome ao dispositivo").max(60)

export async function issueDeviceToken(name: string) {
  const userId = await requireUserId()
  const parsed = nameSchema.parse(name)
  // O valor em claro volta uma única vez: o banco só guarda o hash.
  const { token } = await createDeviceToken(userId, parsed)
  revalidatePath("/informacoes")
  return { token }
}

export async function revokeDeviceTokenAction(id: string) {
  const userId = await requireUserId()
  await revokeDeviceToken(userId, id)
  revalidatePath("/informacoes")
}
