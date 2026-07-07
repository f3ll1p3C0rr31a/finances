"use client"

import { useTransition } from "react"
import { toast } from "sonner"

import { deletePixKey } from "@/lib/actions/pixKeys"
import { Button } from "@/components/ui/button"
import { NewPixKeyDialog } from "@/components/informacoes/new-pix-key-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type PixKeyRow = {
  id: string
  kind: "OWN" | "PAYEE"
  label: string
  keyValue: string
  accountId: string | null
  account: { name: string } | null
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
            <TableHead>Conta vinculada</TableHead>
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
              <TableCell className="font-medium">{key.label}</TableCell>
              <TableCell className="font-mono text-sm">{key.keyValue}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {key.account?.name ?? "—"}
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
