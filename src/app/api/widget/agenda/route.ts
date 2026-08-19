import { userIdFromRequest } from "@/lib/services/deviceTokens"
import { getAgenda } from "@/lib/services/agenda"

export const dynamic = "force-dynamic"

/** O que vence hoje (e o que ficou para trás), para as notificações do app. */
export async function GET(request: Request) {
  const userId = await userIdFromRequest(request)
  if (!userId) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }

  return Response.json(await getAgenda(userId), {
    headers: { "Cache-Control": "no-store" },
  })
}
