import type { MetadataRoute } from "next"

/**
 * Manifesto do PWA. Além de dar ícone e nome próprios quando o app é
 * instalado, é o que o Bubblewrap lê para gerar o APK (TWA) — ver
 * `android/README.md`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fortuna · finanças",
    short_name: "Fortuna",
    description: "Planejamento financeiro pessoal",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "pt-BR",
    dir: "ltr",
    background_color: "#0b0b0f",
    theme_color: "#8b5cf6",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/fortuna-mark.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Cartões", url: "/cards" },
      { name: "Assinaturas", url: "/assinaturas" },
    ],
  }
}
