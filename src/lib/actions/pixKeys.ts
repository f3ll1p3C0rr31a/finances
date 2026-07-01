"use server"

import { revalidatePath } from "next/cache"

import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"

export async function listPixKeys(userId: string, kind?: "OWN" | "PAYEE") {
  return prisma.pixKey.findMany({
    where: { userId, ...(kind ? { kind } : {}) },
    orderBy: { label: "asc" },
  })
}

export async function createPixKey(input: {
  kind: "OWN" | "PAYEE"
  label: string
  keyValue: string
  notes?: string | null
}) {
  const userId = await requireUserId()
  const label = input.label.trim()
  const keyValue = input.keyValue.trim()
  if (!label || !keyValue) throw new Error("Preencha rótulo e chave")

  await prisma.pixKey.create({
    data: {
      userId,
      kind: input.kind,
      label,
      keyValue,
      notes: input.notes?.trim() || null,
    },
  })
  revalidatePath("/informacoes")
  revalidatePath("/dashboard", "layout")
}

export async function deletePixKey(id: string) {
  const userId = await requireUserId()
  await prisma.pixKey.delete({ where: { id, userId } })
  revalidatePath("/informacoes")
  revalidatePath("/dashboard", "layout")
}
