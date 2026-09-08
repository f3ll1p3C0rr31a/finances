"use client"

import Link from "next/link"
import { useRef, useState, useTransition } from "react"
import { Copy, FileText, Link2 } from "lucide-react"
import { toast } from "sonner"

import type { SerializedExpenseEntry } from "@/lib/types"
import {
  removeExpenseAttachment,
  saveExpenseReferences,
  uploadExpenseAttachment,
} from "@/lib/actions/expense"
import { formatBoletoNumber } from "@/lib/calculations/format"
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

export function ExpenseReferencesDialog({ entry }: { entry: SerializedExpenseEntry }) {
  const [open, setOpen] = useState(false)
  const [externalLink, setExternalLink] = useState(entry.externalLink ?? "")
  const [boletoNumber, setBoletoNumber] = useState(entry.boletoNumber ?? "")
  const [pending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasReference = Boolean(entry.externalLink || entry.boletoNumber || entry.hasAttachment)

  function save() {
    startTransition(async () => {
      try {
        await saveExpenseReferences(entry.id, { externalLink, boletoNumber })
        toast.success("Referências salvas.")
        setOpen(false)
      } catch {
        toast.error("Não foi possível salvar as referências.")
      }
    })
  }

  async function copyBoletoNumber() {
    if (!entry.boletoNumber) return
    try {
      await navigator.clipboard.writeText(entry.boletoNumber)
      toast.success("Número do boleto copiado.")
    } catch {
      toast.error("Não foi possível copiar.")
    }
  }

  function upload() {
    const file = fileInputRef.current?.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.set("file", file)
    startTransition(async () => {
      try {
        await uploadExpenseAttachment(entry.id, formData)
        toast.success("PDF anexado.")
        setOpen(false)
      } catch {
        toast.error("Não foi possível anexar o PDF.")
      }
    })
  }

  function removeAttachment() {
    startTransition(async () => {
      try {
        await removeExpenseAttachment(entry.id)
        toast.success("PDF removido.")
        setOpen(false)
      } catch {
        toast.error("Não foi possível remover o PDF.")
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) {
          setExternalLink(entry.externalLink ?? "")
          setBoletoNumber(entry.boletoNumber ?? "")
        }
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant={hasReference ? "secondary" : "ghost"}
            size="xs"
            title="Links e anexos"
          />
        }
      >
        Refs.
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Referências da despesa</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor={`external-link-${entry.id}`}>Link externo</Label>
            <div className="flex gap-2">
              <Input
                id={`external-link-${entry.id}`}
                value={externalLink}
                onChange={(event) => setExternalLink(event.target.value)}
                placeholder="Portal do boleto, área do cliente, etc."
              />
              {entry.externalLink ? (
                <Button
                  variant="outline"
                  size="icon-sm"
                  title="Abrir link"
                  render={<Link href={entry.externalLink} target="_blank" />}
                >
                  <Link2 />
                </Button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`boleto-number-${entry.id}`}>Número do boleto</Label>
            <div className="flex gap-2">
              <Input
                id={`boleto-number-${entry.id}`}
                value={boletoNumber}
                onChange={(event) => setBoletoNumber(event.target.value)}
                inputMode="numeric"
                placeholder="Linha digitável, com ou sem pontos"
              />
              {entry.boletoNumber ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  title="Copiar número"
                  onClick={copyBoletoNumber}
                >
                  <Copy />
                </Button>
              ) : null}
            </div>
            {entry.boletoNumber ? (
              <p className="font-mono text-xs break-all text-muted-foreground">
                {formatBoletoNumber(entry.boletoNumber)}
              </p>
            ) : null}
          </div>

          <div className="rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">PDF do boleto</p>
                <p className="text-xs text-muted-foreground">
                  {entry.attachmentFileName ?? "Nenhum PDF anexado."}
                </p>
              </div>
              {entry.hasAttachment ? (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="xs"
                    render={<Link href={`/api/expense-attachments/${entry.id}`} target="_blank" />}
                  >
                    <FileText />
                    Abrir
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    disabled={pending}
                    onClick={removeAttachment}
                  >
                    Remover
                  </Button>
                </div>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Input ref={fileInputRef} type="file" accept="application/pdf" className="max-w-sm" />
              <Button type="button" variant="outline" size="sm" disabled={pending} onClick={upload}>
                Anexar PDF
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={save} disabled={pending}>
            {pending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
