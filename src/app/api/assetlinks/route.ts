export const dynamic = "force-dynamic"

/**
 * Digital Asset Links: é o que autoriza o APK a abrir este domínio em tela
 * cheia, sem a barra do Chrome por cima (TWA), e a capturar os links do site.
 *
 * A impressão digital SHA-256 da chave de assinatura do APK vem de
 * `ANDROID_APP_FINGERPRINT` (aceita várias, separadas por vírgula — útil para
 * manter a chave de debug junto da de release). Enquanto não estiver definida,
 * responde 404: publicar uma lista vazia faria o Android cachear a negativa.
 *
 * Servido em `/.well-known/assetlinks.json` por um rewrite (next.config.ts),
 * porque o roteador do App Router não expõe pastas iniciadas por ponto.
 */
export function GET() {
  const fingerprints = (process.env.ANDROID_APP_FINGERPRINT ?? "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean)

  if (fingerprints.length === 0) {
    return new Response("assetlinks não configurado", { status: 404 })
  }

  return Response.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: process.env.ANDROID_APP_PACKAGE ?? "com.fellipecorreia.fortuna",
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ],
    { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }
  )
}
