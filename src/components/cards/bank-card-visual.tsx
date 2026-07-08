"use client"

import { useState } from "react"
import { Copy, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"

import {
  cardNumberBlocks,
  detectCardBrand,
  issuerTheme,
  lastFourDigits,
} from "@/lib/cardBrand"
import { CardBrandLogo } from "@/components/brand/card-brand-logo"
import { cn } from "@/lib/utils"

function Chip() {
  return (
    <svg viewBox="0 0 34 24" className="h-6 w-8" aria-hidden="true">
      <rect x="1" y="1" width="32" height="22" rx="4" fill="#e6c96b" stroke="#b89a3e" />
      <path
        d="M1 9h10M1 15h10M23 9h10M23 15h10M17 1v6m0 10v6M11 9a6 6 0 0 1 12 0v6a6 6 0 0 1-12 0Z"
        stroke="#b89a3e"
        strokeWidth="1.2"
        fill="none"
      />
    </svg>
  )
}

function Contactless({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true" style={{ color }}>
      <path
        d="M6 4a10.5 10.5 0 0 1 0 12M9.5 6a7 7 0 0 1 0 8M13 8a3.5 3.5 0 0 1 0 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}

async function copyToClipboard(value: string, message: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(message)
  } catch {
    toast.error("Não foi possível copiar.")
  }
}

export type BankCardVisualProps = {
  name: string
  accountName?: string | null
  cardNumber?: string | null
  cvv?: string | null
  expiryMonth?: number | null
  expiryYear?: number | null
  holderName?: string | null
  /** Compact card for grids (no copy/reveal controls). */
  compact?: boolean
  footer?: React.ReactNode
  className?: string
}

/**
 * A little bank card: issuer colors inferred from the name, network mark
 * from the stored number. In the full variant each number block can be
 * copied with one click (the real digits are copied even while masked),
 * and number/CVV stay hidden behind an eye toggle.
 */
export function BankCardVisual({
  name,
  accountName,
  cardNumber,
  cvv,
  expiryMonth,
  expiryYear,
  holderName,
  compact = false,
  footer,
  className,
}: BankCardVisualProps) {
  const [revealed, setRevealed] = useState(false)

  const theme = issuerTheme(name, accountName)
  const brand = detectCardBrand(cardNumber)
  const blocks = cardNumberBlocks(cardNumber)
  const lastFour = lastFourDigits(cardNumber)
  const digits = (cardNumber ?? "").replace(/\D/g, "")

  const expiry =
    expiryMonth && expiryYear
      ? `${String(expiryMonth).padStart(2, "0")}/${String(expiryYear % 100).padStart(2, "0")}`
      : null

  if (compact) {
    return (
      <div
        className={cn(
          "relative flex aspect-[1.586] w-full flex-col justify-between overflow-hidden rounded-2xl p-4 shadow-lg transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:shadow-xl",
          className
        )}
        style={{ background: theme.background, color: theme.foreground }}
      >
        <div className="pointer-events-none absolute -right-10 -top-16 size-44 rounded-full bg-white/10 blur-sm" />
        <div className="flex items-start justify-between">
          <span className="text-base font-bold tracking-tight drop-shadow-sm">{name}</span>
          <Contactless color={theme.mutedForeground} />
        </div>
        <div className="flex items-end justify-between gap-2">
          <div className="flex flex-col gap-1.5">
            <Chip />
            <span className="font-mono text-sm tracking-[0.18em]" style={{ color: theme.mutedForeground }}>
              {lastFour ? `•••• ${lastFour}` : "•••• ••••"}
            </span>
          </div>
          <CardBrandLogo brand={brand} className="drop-shadow-sm" />
        </div>
        {footer}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "relative w-full max-w-105 overflow-hidden rounded-3xl p-6 shadow-xl",
        className
      )}
      style={{ background: theme.background, color: theme.foreground }}
    >
      <div className="pointer-events-none absolute -right-14 -top-24 size-64 rounded-full bg-white/10 blur-sm" />
      <div className="pointer-events-none absolute -bottom-28 -left-16 size-64 rounded-full bg-black/10 blur-md" />

      <div className="relative flex items-start justify-between">
        <div className="flex flex-col">
          <span className="text-lg font-bold tracking-tight drop-shadow-sm">{name}</span>
          {accountName ? (
            <span className="text-xs" style={{ color: theme.mutedForeground }}>
              {accountName}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Contactless color={theme.mutedForeground} />
          {digits ? (
            <button
              type="button"
              onClick={() => setRevealed((current) => !current)}
              title={revealed ? "Esconder dados" : "Mostrar dados"}
              className="rounded-full p-1.5 transition-colors hover:bg-white/15"
            >
              {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          ) : null}
        </div>
      </div>

      <div className="relative mt-5 flex items-center gap-3">
        <Chip />
      </div>

      <div className="relative mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        {blocks.length > 0 ? (
          blocks.map((block, index) => {
            const isLast = index === blocks.length - 1
            const shown = revealed || isLast ? block : "•".repeat(block.length)
            return (
              <button
                key={index}
                type="button"
                title="Copiar este bloco"
                onClick={() => copyToClipboard(block, `Bloco ${index + 1} copiado.`)}
                className="rounded-md px-1 py-0.5 font-mono text-xl font-medium tracking-[0.14em] drop-shadow-sm transition-colors hover:bg-white/15"
              >
                {shown}
              </button>
            )
          })
        ) : (
          <span className="font-mono text-xl tracking-[0.18em]" style={{ color: theme.mutedForeground }}>
            •••• •••• •••• ••••
          </span>
        )}
        {digits ? (
          <button
            type="button"
            title="Copiar número completo"
            onClick={() => copyToClipboard(digits, "Número do cartão copiado.")}
            className="rounded-full p-1.5 transition-colors hover:bg-white/15"
          >
            <Copy className="size-4" />
          </button>
        ) : null}
      </div>

      <div className="relative mt-5 flex items-end justify-between">
        <div className="flex items-center gap-5 text-sm">
          {holderName ? (
            <span className="uppercase tracking-wide drop-shadow-sm">{holderName}</span>
          ) : null}
          {expiry ? (
            <span className="flex flex-col leading-tight">
              <span className="text-[0.6rem] uppercase" style={{ color: theme.mutedForeground }}>
                Validade
              </span>
              <span className="font-mono">{expiry}</span>
            </span>
          ) : null}
          {cvv ? (
            <button
              type="button"
              title="Copiar CVV"
              onClick={() => copyToClipboard(cvv, "CVV copiado.")}
              className="flex flex-col rounded-md px-1 leading-tight transition-colors hover:bg-white/15"
            >
              <span className="text-[0.6rem] uppercase" style={{ color: theme.mutedForeground }}>
                CVV
              </span>
              <span className="font-mono">{revealed ? cvv : "•".repeat(cvv.length)}</span>
            </button>
          ) : null}
        </div>
        <CardBrandLogo brand={brand} className="drop-shadow-sm" />
      </div>
    </div>
  )
}
