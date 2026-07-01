"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { createAccount } from "@/lib/actions/accounts"
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

export function NewAccountDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [notes, setNotes] = useState("")
  const [pending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      try {
        await createAccount({ name, notes })
        toast.success("Conta salva.")
        setOpen(false)
        setName("")
        setNotes("")
      } catch {
        toast.error("Não foi possível salvar a conta.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>Nova conta</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova conta</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="account-name">Nome</Label>
            <Input
              id="account-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Nubank Conta Corrente"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="account-notes">Notas (opcional)</Label>
            <Input id="account-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={pending || !name.trim()}>
            {pending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
