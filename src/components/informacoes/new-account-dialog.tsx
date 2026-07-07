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
  const [bankName, setBankName] = useState("")
  const [bankCode, setBankCode] = useState("")
  const [agency, setAgency] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [accountDigit, setAccountDigit] = useState("")
  const [accountType, setAccountType] = useState("")
  const [holderName, setHolderName] = useState("")
  const [notes, setNotes] = useState("")
  const [pending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      try {
        await createAccount({
          name,
          bankName,
          bankCode,
          agency,
          accountNumber,
          accountDigit,
          accountType,
          holderName,
          notes,
        })
        toast.success("Conta salva.")
        setOpen(false)
        setName("")
        setBankName("")
        setBankCode("")
        setAgency("")
        setAccountNumber("")
        setAccountDigit("")
        setAccountType("")
        setHolderName("")
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
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="account-bank">Banco</Label>
              <Input
                id="account-bank"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="ex: Nubank"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="account-bank-code">Código do banco</Label>
              <Input
                id="account-bank-code"
                value={bankCode}
                onChange={(e) => setBankCode(e.target.value)}
                placeholder="ex: 260"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="account-agency">Agência</Label>
              <Input
                id="account-agency"
                value={agency}
                onChange={(e) => setAgency(e.target.value)}
                placeholder="ex: 0001"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="account-number">Conta</Label>
              <Input
                id="account-number"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="ex: 123456"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="account-digit">Dígito</Label>
              <Input
                id="account-digit"
                value={accountDigit}
                onChange={(e) => setAccountDigit(e.target.value)}
                placeholder="ex: 7"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="account-type">Tipo de conta</Label>
              <Input
                id="account-type"
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
                placeholder="ex: Conta corrente"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="account-holder">Titular</Label>
              <Input
                id="account-holder"
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
                placeholder="ex: Fellipecorreia"
              />
            </div>
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
