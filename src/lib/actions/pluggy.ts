"use server"

import { revalidatePath } from "next/cache"

import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"
import {
  createConnectToken,
  deleteItem,
  listAccounts,
  pluggyIsConfigured,
} from "@/lib/services/pluggyClient"
import { syncPluggyConnection, type SyncResult } from "@/lib/services/pluggySync"
import {
  pluggyItemSchema,
  linkTargetSchema,
  type LinkTargetInput,
} from "@/lib/validation/pluggySchemas"

function revalidateConnections() {
  revalidatePath("/conexoes")
  revalidatePath("/dashboard", "layout")
  revalidatePath("/cards", "layout")
}

function webhookUrl(): string | undefined {
  const base = process.env.APP_PUBLIC_URL?.replace(/\/$/, "")
  return base ? `${base}/api/webhooks/pluggy` : undefined
}

export async function createPluggyConnectToken(itemId?: string): Promise<string> {
  const userId = await requireUserId()
  if (!pluggyIsConfigured()) {
    throw new Error("Integração com o Pluggy não configurada no servidor")
  }

  if (itemId) {
    // Update mode is only allowed for an item this user owns.
    await prisma.pluggyConnection.findFirstOrThrow({ where: { itemId, userId } })
  }

  return createConnectToken({ clientUserId: userId, itemId, webhookUrl: webhookUrl() })
}

/**
 * Records the item created by the Connect widget and mirrors its accounts as
 * links that are not yet attached to anything — the user picks the local
 * Account/Card afterwards, and only then does data start being imported.
 */
export async function finalizePluggyConnection(item: unknown): Promise<{ id: string }> {
  const userId = await requireUserId()
  const data = pluggyItemSchema.parse(item)

  const connection = await prisma.pluggyConnection.upsert({
    where: { itemId: data.id },
    update: {
      status: data.status,
      executionStatus: data.executionStatus ?? null,
      connectorName: data.connector.name,
      connectorImageUrl: data.connector.imageUrl ?? null,
    },
    create: {
      userId,
      itemId: data.id,
      connectorId: data.connector.id,
      connectorName: data.connector.name,
      connectorImageUrl: data.connector.imageUrl ?? null,
      status: data.status,
      executionStatus: data.executionStatus ?? null,
    },
  })
  if (connection.userId !== userId) throw new Error("Não autorizado")

  const accounts = await listAccounts(data.id)
  for (const account of accounts) {
    await prisma.pluggyAccountLink.upsert({
      where: { pluggyAccountId: account.id },
      update: { name: account.name },
      create: {
        connectionId: connection.id,
        pluggyAccountId: account.id,
        type: account.type,
        name: account.name,
        numberLast4: account.number?.replace(/\D/g, "").slice(-4) || null,
      },
    })
  }

  revalidateConnections()
  return { id: connection.id }
}

async function requireOwnedLink(linkId: string, userId: string) {
  return prisma.pluggyAccountLink.findFirstOrThrow({
    where: { id: linkId, connection: { userId } },
    include: { connection: true },
  })
}

export async function linkPluggyAccount(linkId: string, input: LinkTargetInput) {
  const userId = await requireUserId()
  const data = linkTargetSchema.parse(input)
  const link = await requireOwnedLink(linkId, userId)

  if (data.accountId) {
    await prisma.account.findFirstOrThrow({ where: { id: data.accountId, userId } })
  }
  if (data.cardId) {
    await prisma.card.findFirstOrThrow({ where: { id: data.cardId, userId } })
  }

  await prisma.pluggyAccountLink.update({
    where: { id: link.id },
    data: { accountId: data.accountId, cardId: data.cardId },
  })

  revalidateConnections()
}

export async function unlinkPluggyAccount(linkId: string) {
  const userId = await requireUserId()
  const link = await requireOwnedLink(linkId, userId)
  await prisma.pluggyAccountLink.update({
    where: { id: link.id },
    data: { accountId: null, cardId: null },
  })
  revalidateConnections()
}

export async function setAccountLinkIncludeInBalance(linkId: string, include: boolean) {
  const userId = await requireUserId()
  const link = await requireOwnedLink(linkId, userId)
  await prisma.pluggyAccountLink.update({
    where: { id: link.id },
    data: { includeInBalance: include },
  })
  revalidateConnections()
}

export async function syncPluggyConnectionAction(connectionId: string): Promise<SyncResult> {
  const userId = await requireUserId()
  await prisma.pluggyConnection.findFirstOrThrow({ where: { id: connectionId, userId } })
  const result = await syncPluggyConnection(connectionId)
  revalidateConnections()
  return result
}

/**
 * Revokes access at Pluggy before forgetting the connection locally, so
 * removing it here actually stops the data sharing. Already-imported entries
 * are kept — they are real movements the user may still want.
 */
export async function removePluggyConnection(connectionId: string) {
  const userId = await requireUserId()
  const connection = await prisma.pluggyConnection.findFirstOrThrow({
    where: { id: connectionId, userId },
  })

  await deleteItem(connection.itemId).catch(() => {
    // Item may already be gone at Pluggy; local cleanup still has to happen.
  })
  await prisma.pluggyConnection.delete({ where: { id: connection.id } })

  revalidateConnections()
}
