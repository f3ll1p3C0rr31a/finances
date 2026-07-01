"use server"

import { revalidatePath } from "next/cache"

import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"

export async function listAccounts(userId: string) {
  return prisma.account.findMany({ where: { userId }, orderBy: { name: "asc" } })
}

export async function createAccount(input: { name: string; notes?: string | null }) {
  const userId = await requireUserId()
  const name = input.name.trim()
  if (!name) throw new Error("Informe um nome")

  await prisma.account.create({
    data: { userId, name, notes: input.notes?.trim() || null },
  })
  revalidatePath("/informacoes")
}

export async function setAccountActive(id: string, active: boolean) {
  const userId = await requireUserId()
  await prisma.account.update({ where: { id, userId }, data: { active } })
  revalidatePath("/informacoes")
}

export async function deleteAccount(id: string) {
  const userId = await requireUserId()
  await prisma.account.delete({ where: { id, userId } })
  revalidatePath("/informacoes")
}
