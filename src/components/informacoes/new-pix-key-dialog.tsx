"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { createPixKey } from "@/lib/actions/pixKeys"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function NewPixKeyDialog({ kind }: { kind: "OWN" | "PAYEE" }) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState("")
  const [keyValue, setKeyValue] = useState("")
  const [notes, setNotes] = useState("")
  const [pending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      try {
        await createPixKey({ kind, label, keyValue, notes })
        toast.success("Chave Pix salva.")
        setOpen(false)
        setLabel("")
        setKeyValue("")
        setNotes("")
      } catch {
        toast.error("Não foi possível salvar a chave.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        {kind === "OWN" ? "Nova chave minha" : "Novo pagamento frequente"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{kind === "OWN" ? "Minha chave Pix" : "Pagamento frequente"}</DialogTitle>
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
