import { readFile } from "node:fs/promises"
import path from "node:path"

import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ expenseId: string }> }
) {
  try {
    const userId = await requireUserId()
    const { expenseId } = await params
    const entry = await prisma.expenseEntry.findUniqueOrThrow({
      where: { id: expenseId, userId },
    })
    if (!entry.attachmentPath || !entry.attachmentFileName) {
      return new Response("Arquivo não encontrado", { status: 404 })
    }
    const absolutePath = path.resolve(
      /*turbopackIgnore: true*/ process.cwd(),
      entry.attachmentPath
    )
    const root = path.resolve(/*turbopackIgnore: true*/ process.cwd(), "storage", "boletos")
    if (!absolutePath.startsWith(root)) {
      return new Response("Arquivo inválido", { status: 400 })
    }
    const bytes = await readFile(absolutePath)

    return new Response(bytes, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${encodeURIComponent(entry.attachmentFileName)}"`,
      },
    })
  } catch {
    return new Response("Não autorizado", { status: 401 })
  }
}
