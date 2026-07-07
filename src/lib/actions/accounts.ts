"use server"

import { revalidatePath } from "next/cache"

import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"

export async function listAccounts(userId: string) {
  return prisma.account.findMany({ where: { userId }, orderBy: { name: "asc" } })
}

function clean(value: string | null | undefined) {
  return value?.trim() || null
}

export async function createAccount(input: {
  name: string
  bankName?: string | null
  bankCode?: string | null
  agency?: string | null
  accountNumber?: string | null
  accountDigit?: string | null
  accountType?: string | null
  holderName?: string | null
  notes?: string | null
}) {
  const userId = await requireUserId()
  const name = input.name.trim()
  if (!name) throw new Error("Informe um nome")

  await prisma.account.create({
    data: {
      userId,
      name,
      bankName: clean(input.bankName),
      bankCode: clean(input.bankCode),
      agency: clean(input.agency),
      accountNumber: clean(input.accountNumber),
      accountDigit: clean(input.accountDigit),
      accountType: clean(input.accountType),
      holderName: clean(input.holderName),
      notes: clean(input.notes),
    },
  })
  revalidatePath("/informacoes")
}

export async function updateAccount(
  id: string,
  input: {
    name: string
    bankName?: string | null
    bankCode?: string | null
    agency?: string | null
    accountNumber?: string | null
    accountDigit?: string | null
    accountType?: string | null
    holderName?: string | null
    notes?: string | null
  }
) {
  const userId = await requireUserId()
  const name = input.name.trim()
  if (!name) throw new Error("Informe um nome")

  await prisma.account.update({
    where: { id, userId },
    data: {
      name,
      bankName: clean(input.bankName),
      bankCode: clean(input.bankCode),
      agency: clean(input.agency),
      accountNumber: clean(input.accountNumber),
      accountDigit: clean(input.accountDigit),
      accountType: clean(input.accountType),
      holderName: clean(input.holderName),
      notes: clean(input.notes),
    },
  })
  revalidatePath("/informacoes")
  revalidatePath("/cards", "layout")
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
