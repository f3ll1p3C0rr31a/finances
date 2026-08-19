import { mkdir, writeFile } from "node:fs/promises"
import sharp from "sharp"

/**
 * Gera os ícones do app a partir da mesma moeda desenhada em
 * `src/components/brand/fortuna-logo.tsx`. Rodar quando a marca mudar:
 *
 *   node scripts/generate-icons.mjs
 *
 * `sharp` vem junto com a instalação do Next; não é dependência declarada.
 */

// Aro perlado, como num denário: 24 contas ao redor da moeda.
const beads = Array.from({ length: 24 }, (_, i) => {
  const angle = (i * Math.PI * 2) / 24
  const cx = (32 + Math.cos(angle) * 24.5).toFixed(2)
  const cy = (32 + Math.sin(angle) * 24.5).toFixed(2)
  return `<circle cx="${cx}" cy="${cy}" r="1.4" />`
}).join("")

const coin = `
<defs>
  <radialGradient id="face" cx="38%" cy="30%" r="80%">
    <stop offset="0%" stop-color="#f8e08e" />
    <stop offset="45%" stop-color="#e3b94d" />
    <stop offset="80%" stop-color="#c2932e" />
    <stop offset="100%" stop-color="#9a7020" />
  </radialGradient>
  <linearGradient id="edge" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#8a6318" />
    <stop offset="50%" stop-color="#d9b355" />
    <stop offset="100%" stop-color="#7a5512" />
  </linearGradient>
  <linearGradient id="halo" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#34d399" />
    <stop offset="50%" stop-color="#8b5cf6" />
    <stop offset="100%" stop-color="#d946ef" />
  </linearGradient>
</defs>
<g id="coin">
  <circle cx="32" cy="32" r="30" fill="url(#edge)" />
  <circle cx="32" cy="32" r="27.5" fill="url(#face)" />
  <g fill="#8a6318" opacity="0.85">${beads}</g>
  <g stroke="#7a5512" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.9">
    <path d="M15 40c-1.5-8 1-16 7-21" />
    <path d="M49 40c1.5-8-1-16-7-21" />
  </g>
  <g fill="#7a5512" opacity="0.85">
    <path d="M14.6 36.8c2.4-.3 4.3.7 5 2.6-2.3.6-4.3-.3-5-2.6Z" />
    <path d="M14.9 31.4c2.3-.6 4.3.1 5.4 1.9-2.2.9-4.4.2-5.4-1.9Z" />
    <path d="M16.5 26.2c2.3-.9 4.4-.5 5.7 1.1-2 1.2-4.3.8-5.7-1.1Z" />
    <path d="M19.6 21.6c2-1.3 4.2-1.3 5.8 0-1.7 1.6-4 1.6-5.8 0Z" />
    <path d="M49.4 36.8c-2.4-.3-4.3.7-5 2.6 2.3.6 4.3-.3 5-2.6Z" />
    <path d="M49.1 31.4c-2.3-.6-4.3.1-5.4 1.9 2.2.9 4.4.2 5.4-1.9Z" />
    <path d="M47.5 26.2c-2.3-.9-4.4-.5-5.7 1.1 2 1.2 4.3.8 5.7-1.1Z" />
    <path d="M44.4 21.6c-2-1.3-4.2-1.3-5.8 0 1.7 1.6 4 1.6 5.8 0Z" />
  </g>
  <path d="M27 20.5h13.5a1 1 0 0 1 1 1V25a1 1 0 0 1-1 1H31v6h7a1 1 0 0 1 1 1v3.4a1 1 0 0 1-1 1h-7v8.1a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-24a1 1 0 0 1 1-1Z"
        fill="#fdf3cf" opacity="0.55" transform="translate(-0.7 -0.7)" />
  <path d="M27 20.5h13.5a1 1 0 0 1 1 1V25a1 1 0 0 1-1 1H31v6h7a1 1 0 0 1 1 1v3.4a1 1 0 0 1-1 1h-7v8.1a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-24a1 1 0 0 1 1-1Z"
        fill="#7a5512" />
  <path d="M18 13c4-3.5 9-5 14-4.6" stroke="#fff6d8" stroke-width="2.5" stroke-linecap="round" fill="none" opacity="0.8" />
</g>`

/**
 * @param coinScale fração do lado ocupada pela moeda. Ícone maskable precisa
 *   caber na zona segura (círculo central de 80%), por isso a moeda encolhe.
 * @param radius raio dos cantos do fundo, em unidades de 64.
 */
function markSvg({ coinScale, radius, background }) {
  const size = 64 * coinScale
  const offset = (64 - size) / 2
  const bg = background
    ? `<rect x="0" y="0" width="64" height="64" rx="${radius}" fill="url(#halo)" />`
    : ""
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
${coin}
${bg}
<g transform="translate(${offset} ${offset}) scale(${coinScale})"><use href="#coin" /></g>
</svg>`
}

// Sem fundo: a moeda sozinha, para favicon e para o SVG solto.
const bare = markSvg({ coinScale: 1, radius: 0, background: false })
// Com fundo: o halo esmeralda/violeta do app vira a base do ícone.
const rounded = markSvg({ coinScale: 0.78, radius: 14, background: true })
const maskable = markSvg({ coinScale: 0.6, radius: 0, background: true })

const png = (svg, size) =>
  sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer()

await mkdir("public/icons", { recursive: true })
await writeFile("public/fortuna-mark.svg", bare)
await writeFile("src/app/icon.svg", bare)
await writeFile("public/icons/icon-192.png", await png(rounded, 192))
await writeFile("public/icons/icon-512.png", await png(rounded, 512))
await writeFile("public/icons/icon-maskable-512.png", await png(maskable, 512))
await writeFile("src/app/apple-icon.png", await png(rounded, 180))

console.log("ícones gerados")

// Ícones do launcher Android (android/app/src/main/res/mipmap-*). Densidades
// padrão: mdpi 48, hdpi 72, xhdpi 96, xxhdpi 144, xxxhdpi 192.
const ANDROID_RES = "android/app/src/main/res"
const densities = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 }
for (const [density, size] of Object.entries(densities)) {
  const dir = `${ANDROID_RES}/mipmap-${density}`
  await mkdir(dir, { recursive: true })
  await writeFile(`${dir}/ic_launcher.png`, await png(rounded, size))
  await writeFile(`${dir}/ic_launcher_round.png`, await png(maskable, size))
}
// Foreground do ícone adaptativo: a moeda sozinha, que o Android recorta
// dentro da máscara do aparelho.
await mkdir(`${ANDROID_RES}/mipmap-anydpi-v26`, { recursive: true })
await writeFile(
  `${ANDROID_RES}/mipmap-anydpi-v26/ic_launcher.xml`,
  `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/iconBackground" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
`
)
await writeFile(
  `${ANDROID_RES}/mipmap-anydpi-v26/ic_launcher_round.xml`,
  `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/iconBackground" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
`
)
for (const [density, size] of Object.entries(densities)) {
  const foreground = markSvg({ coinScale: 0.62, radius: 0, background: false })
  await writeFile(
    `${ANDROID_RES}/mipmap-${density}/ic_launcher_foreground.png`,
    await png(foreground, Math.round(size * 2.2))
  )
}

console.log("ícones do Android gerados")
