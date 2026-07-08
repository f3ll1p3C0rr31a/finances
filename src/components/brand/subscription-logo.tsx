"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

/**
 * Known services so a logo appears automatically as soon as the user
 * types a familiar name in the dialog; anything else just needs the
 * service's site (ex: "empresa.com.br") in the logo field.
 */
const KNOWN_SERVICE_DOMAINS: [string, string][] = [
  ["netflix", "netflix.com"],
  ["spotify", "spotify.com"],
  ["youtube", "youtube.com"],
  ["disney", "disneyplus.com"],
  ["max", "max.com"],
  ["hbo", "max.com"],
  ["prime", "primevideo.com"],
  ["amazon", "amazon.com.br"],
  ["globoplay", "globoplay.globo.com"],
  ["deezer", "deezer.com"],
  ["apple", "apple.com"],
  ["icloud", "icloud.com"],
  ["google one", "one.google.com"],
  ["google", "google.com"],
  ["chatgpt", "openai.com"],
  ["openai", "openai.com"],
  ["claude", "claude.ai"],
  ["anthropic", "anthropic.com"],
  ["github", "github.com"],
  ["notion", "notion.so"],
  ["figma", "figma.com"],
  ["canva", "canva.com"],
  ["dropbox", "dropbox.com"],
  ["microsoft", "microsoft.com"],
  ["office", "microsoft.com"],
  ["xbox", "xbox.com"],
  ["playstation", "playstation.com"],
  ["nintendo", "nintendo.com"],
  ["steam", "steampowered.com"],
  ["crunchyroll", "crunchyroll.com"],
  ["paramount", "paramountplus.com"],
  ["telecine", "telecineplay.com.br"],
  ["uol", "uol.com.br"],
  ["evolve", "evolveclub.com.br"],
  ["smartfit", "smartfit.com.br"],
  ["gympass", "wellhub.com"],
  ["wellhub", "wellhub.com"],
  ["duolingo", "duolingo.com"],
  ["alura", "alura.com.br"],
  ["kindle", "amazon.com.br"],
  ["audible", "audible.com"],
  ["twitch", "twitch.tv"],
  ["tinder", "tinder.com"],
  ["linkedin", "linkedin.com"],
  ["mubi", "mubi.com"],
  ["vivo", "vivo.com.br"],
  ["claro", "claro.com.br"],
  ["tim", "tim.com.br"],
]

export function suggestLogoDomain(name: string): string | null {
  const normalized = name.trim().toLowerCase()
  if (!normalized) return null
  for (const [keyword, domain] of KNOWN_SERVICE_DOMAINS) {
    if (normalized.includes(keyword)) return domain
  }
  return null
}

function faviconUrl(domain: string, size: number): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`
}

/**
 * Round logo for a subscription: the service's favicon when a domain is
 * known (stored or inferred from the name), otherwise a colored initial.
 */
export function SubscriptionLogo({
  name,
  logoDomain,
  className,
}: {
  name: string
  logoDomain: string | null
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const domain = logoDomain ?? suggestLogoDomain(name)
  const initial = (name.trim().charAt(0) || "?").toUpperCase()

  if (!domain || failed) {
    return (
      <span
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-400/80 to-violet-500/80 text-xs font-bold text-white",
          className
        )}
        aria-hidden="true"
      >
        {initial}
      </span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny external favicon, not worth the next/image remote allowlist
    <img
      src={faviconUrl(domain, 64)}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn(
        "size-7 shrink-0 rounded-full bg-white object-contain p-0.5 shadow-sm ring-1 ring-black/10",
        className
      )}
    />
  )
}
