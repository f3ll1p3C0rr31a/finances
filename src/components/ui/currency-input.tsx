"use client"

import * as React from "react"

import { Input } from "@/components/ui/input"

function centsToDisplay(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100)
}

type CurrencyInputProps = {
  value: number
  onChange: (value: number) => void
} & Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type">

/**
 * A currency input that fills from the right like a cash register:
 * the user types digits only and the last two always become cents,
 * so there's no comma/period to type and no risk of an ambiguous
 * decimal separator.
 */
export function CurrencyInput({ value, onChange, ...props }: CurrencyInputProps) {
  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const digits = event.target.value.replace(/\D/g, "")
    const cents = digits === "" ? 0 : parseInt(digits, 10)
    onChange(cents / 100)
  }

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={centsToDisplay(Math.round((value || 0) * 100))}
      onChange={handleChange}
      {...props}
    />
  )
}
