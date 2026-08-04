import { timingSafeEqual } from "node:crypto"

import { prisma } from "@/lib/prisma"
import { syncPluggyConnection } from "@/lib/services/pluggySync"

export const dynamic = "force-dynamic"

/** Events that mean there may be new data to pull for the item. */
const SYNC_EVENTS = new Set([
  "item/updated",
  "item/created",
  "transactions/created",
  "transactions/updated",
  "transactions/deleted",
])

function isAuthorized(request: Request): boolean {
  const secret = process.env.PLUGGY_WEBHOOK_SECRET
  if (!secret) return false

  const header = request.headers.get("authorization") ?? ""
  const expected = `Bearer ${secret}`
  const received = Buffer.from(header)
  const expectedBuffer = Buffer.from(expected)
  if (received.length !== expectedBuffer.length) return false
  return timingSafeEqual(received, expectedBuffer)
}

/**
 * Pluggy does not sign webhook payloads, so authenticity comes from the
 * custom Authorization header configured when the webhook is registered.
 * Pluggy expects a 2xx within 5s and retries on failure, so this responds as
 * soon as the sync finishes or errors — never leaving the request hanging.
 */
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return new Response("Não autorizado", { status: 401 })
  }

  let payload: { event?: string; itemId?: string }
  try {
    payload = await request.json()
  } catch {
    return new Response("Payload inválido", { status: 400 })
  }

  const { event, itemId } = payload
  if (!event || !itemId) {
    return new Response("Payload incompleto", { status: 400 })
  }
  if (!SYNC_EVENTS.has(event)) {
    return Response.json({ ignored: event })
  }

  const connection = await prisma.pluggyConnection.findUnique({
    where: { itemId },
    select: { id: true },
  })
  if (!connection) {
    // Unknown item: acknowledge so Pluggy stops retrying.
    return Response.json({ ignored: "unknown_item" })
  }

  try {
    const result = await syncPluggyConnection(connection.id)
    return Response.json({ synced: true, ...result })
  } catch (error) {
    console.error("Falha ao sincronizar via webhook do Pluggy", error)
    return new Response("Erro ao sincronizar", { status: 500 })
  }
}
