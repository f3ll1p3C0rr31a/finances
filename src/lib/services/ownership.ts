import { prisma } from "@/lib/prisma"

/**
 * Confere que um recurso apontado por id pertence ao usuário antes de gravar a
 * referência.
 *
 * Sem isso, um id de cartão ou de chave Pix vindo do formulário é gravado como
 * veio: as Server Actions verificam a posse do registro que estão editando,
 * mas não a das chaves estrangeiras que ele passa a apontar. O app é de um
 * usuário só, então hoje isso não vaza nada — é uma trava barata para não
 * depender disso continuar verdade.
 */
export async function assertOwnedCard(userId: string, cardId: string | null | undefined) {
  if (!cardId) return
  const card = await prisma.card.findFirst({ where: { id: cardId, userId }, select: { id: true } })
  if (!card) throw new Error("Cartão não encontrado")
}

export async function assertOwnedPixKey(userId: string, pixKeyId: string | null | undefined) {
  if (!pixKeyId) return
  const key = await prisma.pixKey.findFirst({
    where: { id: pixKeyId, userId },
    select: { id: true },
  })
  if (!key) throw new Error("Chave Pix não encontrada")
}
