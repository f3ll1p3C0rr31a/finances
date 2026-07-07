"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { createPixKey, updatePixKey } from "@/lib/actions/pixKeys"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

const PIX_KEY_TYPE_LABELS = {
  PHONE: "Celular",
  CPF: "CPF",
  CNPJ: "CNPJ",
  EMAIL: "E-mail",
  RANDOM: "Aleatória",
} as const

type PixKeyDialogRow = {
  id: string
  kind: "OWN" | "PAYEE"
  keyType: keyof typeof PIX_KEY_TYPE_LABELS | null
  label: string
  keyValue: string
  accountId: string | null
  destinationBankName: string | null
  destinationBankCode: string | null
  notes: string | null
}

export function NewPixKeyDialog({
  kind,
  accounts = [],
  pixKey,
  triggerLabel,
  triggerVariant,
  triggerSize = "sm",
}: {
  kind: "OWN" | "PAYEE"
  accounts?: { id: string; name: string }[]
  pixKey?: PixKeyDialogRow
  triggerLabel?: string
  triggerVariant?: "default" | "ghost"
  triggerSize?: "sm" | "xs"
}) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState(pixKey?.label ?? "")
  const [keyType, setKeyType] = useState<keyof typeof PIX_KEY_TYPE_LABELS>(
    pixKey?.keyType ?? "PHONE"
  )
  const [keyValue, setKeyValue] = useState(pixKey?.keyValue ?? "")
  const [accountId, setAccountId] = useState<string | null>(pixKey?.accountId ?? null)
  const [destinationBankName, setDestinationBankName] = useState(
    pixKey?.destinationBankName ?? ""
  )
  const [destinationBankCode, setDestinationBankCode] = useState(
    pixKey?.destinationBankCode ?? ""
  )
  const [notes, setNotes] = useState(pixKey?.notes ?? "")
  const [pending, startTransition] = useTransition()

  const isEditing = Boolean(pixKey)

  function resetForm() {
    setLabel(pixKey?.label ?? "")
    setKeyType(pixKey?.keyType ?? "PHONE")
    setKeyValue(pixKey?.keyValue ?? "")
    setAccountId(pixKey?.accountId ?? null)
    setDestinationBankName(pixKey?.destinationBankName ?? "")
    setDestinationBankCode(pixKey?.destinationBankCode ?? "")
    setNotes(pixKey?.notes ?? "")
  }

  function save() {
    startTransition(async () => {
      try {
        const payload = {
          kind,
          keyType,
          label,
          keyValue,
          accountId,
          destinationBankName,
          destinationBankCode,
          notes,
        }
        if (pixKey) {
          await updatePixKey(pixKey.id, payload)
        } else {
          await createPixKey(payload)
        }
        toast.success("Chave Pix salva.")
        setOpen(false)
        if (!pixKey) resetForm()
      } catch {
        toast.error("Não foi possível salvar a chave.")
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) resetForm()
      }}
    >
      <DialogTrigger render={<Button size={triggerSize} variant={triggerVariant} />}>
        {triggerLabel ?? (kind === "OWN" ? "Nova chave minha" : "Novo pagamento frequente")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? "Editar chave Pix"
              : kind === "OWN"
                ? "Minha chave Pix"
                : "Pagamento frequente"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="pix-label">
              {kind === "OWN" ? "Rótulo (ex: Conta principal)" : "Nome (ex: Proprietária aluguel)"}
            </Label>
            <Input id="pix-label" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pix-key">Chave Pix</Label>
            <Input id="pix-key" value={keyValue} onChange={(e) => setKeyValue(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Tipo da chave</Label>
            <Select
              value={keyType}
              onValueChange={(value) => setKeyType(value as keyof typeof PIX_KEY_TYPE_LABELS)}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value: string) =>
                    PIX_KEY_TYPE_LABELS[value as keyof typeof PIX_KEY_TYPE_LABELS]
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PIX_KEY_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {kind === "OWN" ? (
          <div className="grid gap-2">
            <Label>Conta vinculada (opcional)</Label>
            <Select
              value={accountId ?? "NONE"}
              onValueChange={(value) => setAccountId(value === "NONE" ? null : value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value: string) =>
                    value === "NONE"
                      ? "Nenhuma"
                      : accounts.find((account) => account.id === value)?.name ?? "Nenhuma"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Nenhuma</SelectItem>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          ) : (
            <div className="grid grid-cols-[1fr_8rem] gap-3">
              <div className="grid gap-2">
                <Label htmlFor="pix-destination-bank">Banco de destino</Label>
                <Input
                  id="pix-destination-bank"
                  value={destinationBankName}
                  onChange={(e) => setDestinationBankName(e.target.value)}
                  placeholder="ex: Banco do Brasil"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pix-destination-code">Código</Label>
                <Input
                  id="pix-destination-code"
                  value={destinationBankCode}
                  onChange={(e) => setDestinationBankCode(e.target.value)}
                  placeholder="001"
                />
              </div>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="pix-notes">Notas (opcional)</Label>
            <Input id="pix-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={pending || !label.trim() || !keyValue.trim()}>
            {pending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
