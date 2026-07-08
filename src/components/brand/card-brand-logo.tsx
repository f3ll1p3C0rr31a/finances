import type { CardBrand } from "@/lib/cardBrand"
import { CARD_BRAND_LABELS } from "@/lib/cardBrand"
import { cn } from "@/lib/utils"

/**
 * Simplified, self-contained network marks (no external assets) sized
 * for the corner of the bank-card visual.
 */
export function CardBrandLogo({
  brand,
  className,
}: {
  brand: CardBrand
  className?: string
}) {
  const label = CARD_BRAND_LABELS[brand]

  if (brand === "mastercard") {
    return (
      <svg viewBox="0 0 48 30" className={cn("h-6", className)} role="img" aria-label={label}>
        <circle cx="19" cy="15" r="12" fill="#EB001B" />
        <circle cx="31" cy="15" r="12" fill="#F79E1B" />
        <path
          d="M25 5.6a12 12 0 0 1 0 18.8 12 12 0 0 1 0-18.8Z"
          fill="#FF5F00"
        />
      </svg>
    )
  }

  if (brand === "visa") {
    return (
      <svg viewBox="0 0 60 20" className={cn("h-4", className)} role="img" aria-label={label}>
        <text
          x="30"
          y="16"
          textAnchor="middle"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fontSize="19"
          fontWeight="800"
          fontStyle="italic"
          fill="currentColor"
        >
          VISA
        </text>
      </svg>
    )
  }

  if (brand === "elo") {
    return (
      <svg viewBox="0 0 52 20" className={cn("h-5", className)} role="img" aria-label={label}>
        <circle cx="10" cy="10" r="8" fill="currentColor" opacity="0.95" />
        <path d="M10 3.5a6.5 6.5 0 0 1 0 13z" fill="#FFCB05" />
        <path d="M10 3.5a6.5 6.5 0 0 0 0 13z" fill="#00A4E0" />
        <text
          x="22"
          y="15.5"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fontSize="15"
          fontWeight="800"
          fill="currentColor"
        >
          elo
        </text>
      </svg>
    )
  }

  if (brand === "amex") {
    return (
      <svg viewBox="0 0 44 28" className={cn("h-6", className)} role="img" aria-label={label}>
        <rect width="44" height="28" rx="4" fill="#2E77BC" />
        <text
          x="22"
          y="13"
          textAnchor="middle"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fontSize="9"
          fontWeight="800"
          fill="#fff"
        >
          AMERICAN
        </text>
        <text
          x="22"
          y="23"
          textAnchor="middle"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fontSize="9"
          fontWeight="800"
          fill="#fff"
        >
          EXPRESS
        </text>
      </svg>
    )
  }

  if (brand === "hipercard") {
    return (
      <svg viewBox="0 0 74 20" className={cn("h-4", className)} role="img" aria-label={label}>
        <rect width="74" height="20" rx="10" fill="#B3131B" />
        <text
          x="37"
          y="14.5"
          textAnchor="middle"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fontSize="11"
          fontWeight="800"
          fontStyle="italic"
          fill="#fff"
        >
          Hipercard
        </text>
      </svg>
    )
  }

  if (brand === "diners" || brand === "discover") {
    return (
      <svg viewBox="0 0 60 20" className={cn("h-4", className)} role="img" aria-label={label}>
        <text
          x="30"
          y="15"
          textAnchor="middle"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fontSize="11"
          fontWeight="800"
          fill="currentColor"
        >
          {brand === "diners" ? "Diners Club" : "DISCOVER"}
        </text>
      </svg>
    )
  }

  return null
}
