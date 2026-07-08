export type CardBrand =
  | "visa"
  | "mastercard"
  | "amex"
  | "elo"
  | "hipercard"
  | "diners"
  | "discover"
  | "unknown"

export const CARD_BRAND_LABELS: Record<CardBrand, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  elo: "Elo",
  hipercard: "Hipercard",
  diners: "Diners Club",
  discover: "Discover",
  unknown: "Cartão",
}

const ELO_PREFIXES = [
  "401178", "401179", "431274", "438935", "451416", "457393", "457631",
  "457632", "504175", "506699", "506770", "509", "627780", "636297",
  "636368", "650031", "650035", "650405", "650485", "650541", "650700",
  "650720", "650901", "651652", "655000", "655021",
]

/**
 * Detects the network from the card number (digits only or formatted).
 * Elo shares leading digits with Visa/Mastercard, so its BIN prefixes
 * are checked first.
 */
export function detectCardBrand(cardNumber: string | null | undefined): CardBrand {
  const digits = (cardNumber ?? "").replace(/\D/g, "")
  if (digits.length < 4) return "unknown"

  if (ELO_PREFIXES.some((prefix) => digits.startsWith(prefix))) return "elo"
  if (/^(606282|3841)/.test(digits)) return "hipercard"
  if (/^3[47]/.test(digits)) return "amex"
  if (/^3(0[0-5]|[68])/.test(digits)) return "diners"
  if (/^(6011|65)/.test(digits)) return "discover"
  if (/^4/.test(digits)) return "visa"
  if (/^(5[1-5]|2(22[1-9]|2[3-9]\d|[3-6]\d{2}|7[01]\d|720))/.test(digits)) return "mastercard"
  return "unknown"
}

export function cardNumberBlocks(cardNumber: string | null | undefined): string[] {
  const digits = (cardNumber ?? "").replace(/\D/g, "")
  if (!digits) return []
  if (detectCardBrand(digits) === "amex" && digits.length === 15) {
    return [digits.slice(0, 4), digits.slice(4, 10), digits.slice(10, 15)]
  }
  return digits.match(/.{1,4}/g) ?? []
}

export function lastFourDigits(cardNumber: string | null | undefined): string | null {
  const digits = (cardNumber ?? "").replace(/\D/g, "")
  return digits.length >= 4 ? digits.slice(-4) : null
}

export type IssuerTheme = {
  /** CSS background of the little bank card. */
  background: string
  /** Foreground color that stays readable on top of it. */
  foreground: string
  /** Subtle foreground for secondary text. */
  mutedForeground: string
}

const ISSUER_THEMES: { keywords: string[]; theme: IssuerTheme }[] = [
  {
    keywords: ["nubank", "nu "],
    theme: {
      background: "linear-gradient(135deg, #820ad1 0%, #5d0a9e 55%, #3c0764 100%)",
      foreground: "#ffffff",
      mutedForeground: "rgba(255,255,255,0.72)",
    },
  },
  {
    keywords: ["inter"],
    theme: {
      background: "linear-gradient(135deg, #ff7a00 0%, #e65c00 55%, #b34700 100%)",
      foreground: "#ffffff",
      mutedForeground: "rgba(255,255,255,0.78)",
    },
  },
  {
    keywords: ["itaú", "itau"],
    theme: {
      background: "linear-gradient(135deg, #ec7000 0%, #cc5c00 50%, #002f6c 100%)",
      foreground: "#ffffff",
      mutedForeground: "rgba(255,255,255,0.78)",
    },
  },
  {
    keywords: ["bradesco"],
    theme: {
      background: "linear-gradient(135deg, #cc092f 0%, #a00724 60%, #64051a 100%)",
      foreground: "#ffffff",
      mutedForeground: "rgba(255,255,255,0.76)",
    },
  },
  {
    keywords: ["santander"],
    theme: {
      background: "linear-gradient(135deg, #ec0000 0%, #c50000 55%, #8f0000 100%)",
      foreground: "#ffffff",
      mutedForeground: "rgba(255,255,255,0.76)",
    },
  },
  {
    keywords: ["caixa"],
    theme: {
      background: "linear-gradient(135deg, #0070af 0%, #005ca9 55%, #f39200 130%)",
      foreground: "#ffffff",
      mutedForeground: "rgba(255,255,255,0.78)",
    },
  },
  {
    keywords: ["banco do brasil", "bb "],
    theme: {
      background: "linear-gradient(135deg, #fdf200 0%, #f5d800 55%, #003da5 160%)",
      foreground: "#1c2b6b",
      mutedForeground: "rgba(28,43,107,0.72)",
    },
  },
  {
    keywords: ["c6"],
    theme: {
      background: "linear-gradient(135deg, #2b2b2b 0%, #171717 60%, #000000 100%)",
      foreground: "#f2e2c4",
      mutedForeground: "rgba(242,226,196,0.7)",
    },
  },
  {
    keywords: ["xp"],
    theme: {
      background: "linear-gradient(135deg, #1f1f1f 0%, #0d0d0d 60%, #000000 100%)",
      foreground: "#ffffff",
      mutedForeground: "rgba(255,255,255,0.7)",
    },
  },
  {
    keywords: ["btg"],
    theme: {
      background: "linear-gradient(135deg, #0a2a66 0%, #001e62 60%, #001233 100%)",
      foreground: "#ffffff",
      mutedForeground: "rgba(255,255,255,0.74)",
    },
  },
  {
    keywords: ["picpay"],
    theme: {
      background: "linear-gradient(135deg, #21c25e 0%, #14a04a 60%, #0c6e33 100%)",
      foreground: "#ffffff",
      mutedForeground: "rgba(255,255,255,0.78)",
    },
  },
  {
    keywords: ["mercado pago", "mercadopago", "meli"],
    theme: {
      background: "linear-gradient(135deg, #00aeef 0%, #0080d6 55%, #003087 100%)",
      foreground: "#ffffff",
      mutedForeground: "rgba(255,255,255,0.78)",
    },
  },
  {
    keywords: ["neon"],
    theme: {
      background: "linear-gradient(135deg, #00d1ff 0%, #00a5e4 55%, #0069a8 100%)",
      foreground: "#ffffff",
      mutedForeground: "rgba(255,255,255,0.8)",
    },
  },
  {
    keywords: ["original"],
    theme: {
      background: "linear-gradient(135deg, #00b356 0%, #009540 60%, #00602a 100%)",
      foreground: "#ffffff",
      mutedForeground: "rgba(255,255,255,0.78)",
    },
  },
  {
    keywords: ["safra"],
    theme: {
      background: "linear-gradient(135deg, #123a75 0%, #06225c 60%, #021031 100%)",
      foreground: "#e9d8a6",
      mutedForeground: "rgba(233,216,166,0.75)",
    },
  },
  {
    keywords: ["sicredi"],
    theme: {
      background: "linear-gradient(135deg, #4a9e2f 0%, #33820d 60%, #1e5206 100%)",
      foreground: "#ffffff",
      mutedForeground: "rgba(255,255,255,0.78)",
    },
  },
  {
    keywords: ["sicoob"],
    theme: {
      background: "linear-gradient(135deg, #0b4f4f 0%, #003641 65%, #7db61c 160%)",
      foreground: "#ffffff",
      mutedForeground: "rgba(255,255,255,0.78)",
    },
  },
  {
    keywords: ["next"],
    theme: {
      background: "linear-gradient(135deg, #1a1a1a 0%, #0f2418 60%, #00ff5f 200%)",
      foreground: "#7dffab",
      mutedForeground: "rgba(125,255,171,0.7)",
    },
  },
  {
    keywords: ["will"],
    theme: {
      background: "linear-gradient(135deg, #ffd500 0%, #ffb800 60%, #995c00 160%)",
      foreground: "#332200",
      mutedForeground: "rgba(51,34,0,0.7)",
    },
  },
  {
    keywords: ["pan"],
    theme: {
      background: "linear-gradient(135deg, #00c9be 0%, #00b2a9 55%, #006d68 100%)",
      foreground: "#ffffff",
      mutedForeground: "rgba(255,255,255,0.78)",
    },
  },
]

const DEFAULT_THEME: IssuerTheme = {
  background: "linear-gradient(135deg, #34d399 0%, #8b5cf6 60%, #d946ef 100%)",
  foreground: "#ffffff",
  mutedForeground: "rgba(255,255,255,0.78)",
}

/**
 * Picks the visual identity of the little bank card from the card or
 * account name (e.g. "Nubank" -> roxo). Unknown issuers fall back to the
 * Fortuna gradient.
 */
export function issuerTheme(...names: (string | null | undefined)[]): IssuerTheme {
  const haystack = ` ${names.filter(Boolean).join(" ").toLowerCase()} `
  for (const { keywords, theme } of ISSUER_THEMES) {
    if (keywords.some((keyword) => haystack.includes(keyword))) return theme
  }
  return DEFAULT_THEME
}
