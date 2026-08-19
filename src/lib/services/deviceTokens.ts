import { createHash, randomBytes, timingSafeEqual } from "node:crypto"

import { prisma } from "@/lib/prisma"

/**
 * Tokens de dispositivo — a credencial do widget do Android.
 *
 * O widget roda fora do navegador e não tem como manter a sessão do
 * NextAuth, então precisa de uma credencial própria, de vida longa e
 * revogável sem derrubar o login da web.
 *
 * O banco guarda apenas o SHA-256 do token. Vazar o banco não entrega acesso,
 * e é por isso que o valor em claro só aparece uma vez, na criação. SHA-256
 * puro (sem bcrypt) é adequado aqui porque o token é 256 bits aleatórios, não
 * uma senha escolhida por gente: não há dicionário a percorrer.
 */

const TOKEN_BYTES = 32

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export async function createDeviceToken(userId: string, name: string) {
  const token = randomBytes(TOKEN_BYTES).toString("base64url")
  const record = await prisma.deviceToken.create({
    data: { userId, name, tokenHash: hashToken(token) },
  })
  return { id: record.id, token }
}

export async function listDeviceTokens(userId: string) {
  return prisma.deviceToken.findMany({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, createdAt: true, lastUsedAt: true },
  })
}

export async function revokeDeviceToken(userId: string, id: string) {
  await prisma.deviceToken.updateMany({
    where: { id, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

/**
 * Resolve o dono de um `Authorization: Bearer <token>`, ou null.
 *
 * A comparação do hash é feita em tempo constante mesmo já sendo uma busca por
 * índice: manter o hábito custa nada e evita que uma mudança futura na
 * consulta abra um oráculo de tempo.
 */
export async function userIdFromRequest(request: Request): Promise<string | null> {
  const header = request.headers.get("authorization")
  if (!header?.startsWith("Bearer ")) return null

  const token = header.slice("Bearer ".length).trim()
  if (!token) return null

  const tokenHash = hashToken(token)
  const record = await prisma.deviceToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, tokenHash: true, revokedAt: true },
  })
  if (!record || record.revokedAt) return null

  const a = Buffer.from(record.tokenHash)
  const b = Buffer.from(tokenHash)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  // Serve para o usuário reconhecer um token esquecido antes de revogar.
  await prisma.deviceToken.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() },
  })

  return record.userId
}
