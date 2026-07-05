export const dynamic = "force-dynamic"

export function GET() {
  return Response.json(
    {
      commit: process.env.APP_COMMIT_SHA ?? "unknown",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  )
}
