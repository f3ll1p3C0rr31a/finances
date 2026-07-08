"use client"

import { useTransition } from "react"
import { toast } from "sonner"

import { deletePixKey } from "@/lib/actions/pixKeys"
import { Button } from "@/components/ui/button"
import { NewPixKeyDialog } from "@/components/informacoes/new-pix-key-dialog"
import { PixIcon } from "@/components/brand/pix-icon"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const PIX_KEY_TYPE_LABELS = {
  PHONE: "Celular",
  CPF: "CPF",
  CNPJ: "CNPJ",
  EMAIL: "E-mail",
  RANDOM: "Aleatória",
} as const

type PixKeyRow = {
  id: string
  kind: "OWN" | "PAYEE"
  keyType: keyof typeof PIX_KEY_TYPE_LABELS | null
  label: string
  keyValue: string
  accountId: string | null
  account: { name: string } | null
  destinationBankName: string | null
  destinationBankCode: string | null
  notes: string | null
}

export function PixKeyList({
  pixKeys,
  accounts,
  kind,
}: {
  pixKeys: PixKeyRow[]
  accounts: { id: string; name: string }[]
  kind: "OWN" | "PAYEE"
}) {
  const [pending, startTransition] = useTransition()

  function remove(id: string) {
    startTransition(async () => {
      try {
        await deletePixKey(id)
        toast.success("Chave removida.")
      } catch {
        toast.error("Não foi possível remover.")
      }
    })
  }

  return (
    <Table>
      <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Chave</TableHead>
            <TableHead>{kind === "OWN" ? "Conta vinculada" : "Banco de destino"}</TableHead>
            <TableHead>Notas</TableHead>
            <TableHead className="w-0" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {pixKeys.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground">
              Nenhuma chave cadastrada.
            </TableCell>
          </TableRow>
        ) : (
          pixKeys.map((key) => (
            <TableRow key={key.id}>
              <TableCell className="font-medium">
                <span className="inline-flex items-center gap-2">
                  <PixIcon />
                  {key.label}
                </span>
              </TableCell>
              <TableCell className="font-mono text-sm">
                {key.keyValue}
                {key.keyType ? (
                  <span className="block font-sans text-xs text-muted-foreground">
                    {PIX_KEY_TYPE_LABELS[key.keyType]}
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {kind === "OWN" ? (
                  key.account?.name ?? "—"
                ) : (
                  <>
                    {key.destinationBankName ?? "—"}
                    {key.destinationBankCode ? (
                      <span className="block text-xs">Código {key.destinationBankCode}</span>
                    ) : null}
                  </>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{key.notes ?? "—"}</TableCell>
              <TableCell className="text-right">
                <NewPixKeyDialog
                  kind={kind}
                  accounts={accounts}
                  pixKey={key}
                  triggerLabel="Editar"
                  triggerVariant="ghost"
                  triggerSize="xs"
                />
                <Button variant="ghost" size="xs" disabled={pending} onClick={() => remove(key.id)}>
                  Excluir
                </Button>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
