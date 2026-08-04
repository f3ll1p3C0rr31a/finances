"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { linkPluggyAccount, syncPluggyConnectionAction } from "@/lib/actions/pluggy"
import type { SerializedPluggyAccountLink } from "@/lib/types"
import { Button } from "@/components/ui/button"
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

type Option = { id: string; name: string }

export function LinkAccountDialog({
  link,
  connectionId,
  accounts,
  cards,
}: {
  link: SerializedPluggyAccountLink
  connectionId: string
  accounts: Option[]
  cards: Option[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const isCard = link.type === "CREDIT"
  const options = isCard ? cards : accounts
  const suggestion = isCard ? link.suggestedCardId : link.suggestedAccountId
  const [selected, setSelected] = useState<string>(suggestion ?? "")

  function save() {
    if (!selected) {
      toast.error(isCard ? "Escolha um cartão." : "Escolha uma conta.")
      return
    }
    startTransition(async () => {
      try {
        await linkPluggyAccount(link.id, {
          accountId: isCard ? null : selected,
          cardId: isCard ? selected : null,
        })
        setOpen(false)
        toast.success("Vinculado. Importando o histórico, isso pode demorar...")
        // First load pulls full history; run it here (no webhook 5s limit).
        await syncPluggyConnectionAction(connectionId)
        toast.success("Histórico importado.")
        router.refresh()
      } catch {
        toast.error("Não foi possível vincular esta conta.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>Vincular</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vincular {link.name}</DialogTitle>
          <DialogDescription>
            {isCard
              ? "Escolha o cartão do Fortuna que corresponde a este cartão do banco. As compras passarão a ser importadas automaticamente."
              : "Escolha a conta do Fortuna que corresponde a esta conta do banco. Os lançamentos passarão a ser importados automaticamente."}
            {suggestion ? " Já sugerimos o mais provável." : ""}
          </DialogDescription>
        </DialogHeader>

        {options.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {isCard
              ? "Nenhum cartão cadastrado. Crie o cartão primeiro na aba Cartões."
              : "Nenhuma conta cadastrada. Crie a conta primeiro na aba Informações."}
          </p>
        ) : (
          <Select value={selected} onValueChange={(value) => setSelected(value ?? "")}>
            <SelectTrigger className="w-full">
              <SelectValue>
                {(value: string) =>
                  options.find((option) => option.id === value)?.name ?? "Selecione"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <p className="text-xs text-muted-foreground">
          O histórico disponível será importado agora. Revise os lançamentos marcados como
          “Importado” para remover eventuais duplicatas do que você já havia lançado à mão.
        </p>

        <DialogFooter>
          <Button onClick={save} disabled={pending || options.length === 0}>
            {pending ? "Vinculando..." : "Vincular e importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
