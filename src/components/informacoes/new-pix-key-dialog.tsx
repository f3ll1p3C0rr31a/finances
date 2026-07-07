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

type PixKeyDialogRow = {
  id: string
  kind: "OWN" | "PAYEE"
  label: string
  keyValue: string
  accountId: string | null
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
  const [keyValue, setKeyValue] = useState(pixKey?.keyValue ?? "")
  const [accountId, setAccountId] = useState<string | null>(pixKey?.accountId ?? null)
  const [notes, setNotes] = useState(pixKey?.notes ?? "")
  const [pending, startTransition] = useTransition()

  const isEditing = Boolean(pixKey)

  function resetForm() {
    setLabel(pixKey?.label ?? "")
    setKeyValue(pixKey?.keyValue ?? "")
    setAccountId(pixKey?.accountId ?? null)
    setNotes(pixKey?.notes ?? "")
  }

  function save() {
    startTransition(async () => {
      try {
        const payload = { kind, label, keyValue, accountId, notes }
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
