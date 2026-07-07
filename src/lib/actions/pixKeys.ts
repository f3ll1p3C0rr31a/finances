"use server"

import { revalidatePath } from "next/cache"

import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"

type PixKeyTypeInput = "PHONE" | "CPF" | "CNPJ" | "EMAIL" | "RANDOM"

export async function listPixKeys(userId: string, kind?: "OWN" | "PAYEE") {
  return prisma.pixKey.findMany({
    where: { userId, ...(kind ? { kind } : {}) },
    orderBy: { label: "asc" },
    include: { account: true },
  })
}

export async function createPixKey(input: {
  kind: "OWN" | "PAYEE"
  keyType?: PixKeyTypeInput | null
  label: string
  keyValue: string
  accountId?: string | null
  destinationBankName?: string | null
  destinationBankCode?: string | null
  notes?: string | null
}) {
  const userId = await requireUserId()
  const label = input.label.trim()
  const keyValue = input.keyValue.trim()
  if (!label || !keyValue) throw new Error("Preencha rótulo e chave")
  const accountId = input.kind === "OWN" ? input.accountId?.trim() || null : null
  const destinationBankName =
    input.kind === "PAYEE" ? input.destinationBankName?.trim() || null : null
  const destinationBankCode =
    input.kind === "PAYEE" ? input.destinationBankCode?.trim() || null : null

  if (accountId) {
    await prisma.account.findUniqueOrThrow({ where: { id: accountId, userId } })
  }

  await prisma.pixKey.create({
    data: {
      userId,
      accountId,
      kind: input.kind,
      keyType: input.keyType ?? null,
      label,
      keyValue,
      destinationBankName,
      destinationBankCode,
      notes: input.notes?.trim() || null,
    },
  })
  revalidatePath("/informacoes")
  revalidatePath("/dashboard", "layout")
}

export async function updatePixKey(
  id: string,
  input: {
    kind: "OWN" | "PAYEE"
    keyType?: PixKeyTypeInput | null
    label: string
    keyValue: string
    accountId?: string | null
    destinationBankName?: string | null
    destinationBankCode?: string | null
    notes?: string | null
  }
) {
  const userId = await requireUserId()
  const label = input.label.trim()
  const keyValue = input.keyValue.trim()
  if (!label || !keyValue) throw new Error("Preencha rótulo e chave")
  const accountId = input.kind === "OWN" ? input.accountId?.trim() || null : null
  const destinationBankName =
    input.kind === "PAYEE" ? input.destinationBankName?.trim() || null : null
  const destinationBankCode =
    input.kind === "PAYEE" ? input.destinationBankCode?.trim() || null : null

  if (accountId) {
    await prisma.account.findUniqueOrThrow({ where: { id: accountId, userId } })
  }

  await prisma.pixKey.update({
    where: { id, userId },
    data: {
      accountId,
      kind: input.kind,
      keyType: input.keyType ?? null,
      label,
      keyValue,
      destinationBankName,
      destinationBankCode,
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
