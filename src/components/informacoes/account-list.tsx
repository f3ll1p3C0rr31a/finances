"use client"

import { useTransition } from "react"
import { toast } from "sonner"

import { setAccountActive, deleteAccount } from "@/lib/actions/accounts"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type AccountRow = { id: string; name: string; active: boolean; notes: string | null }

export function AccountList({ accounts }: { accounts: AccountRow[] }) {
  const [pending, startTransition] = useTransition()

  function toggleActive(id: string, active: boolean) {
    startTransition(async () => {
      try {
        await setAccountActive(id, active)
      } catch {
        toast.error("Não foi possível atualizar.")
      }
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      try {
        await deleteAccount(id)
        toast.success("Conta removida.")
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
          <TableHead>Notas</TableHead>
          <TableHead className="text-center">Ativa</TableHead>
          <TableHead className="w-0" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {accounts.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-muted-foreground">
              Nenhuma conta cadastrada.
            </TableCell>
          </TableRow>
        ) : (
          accounts.map((account) => (
            <TableRow key={account.id}>
              <TableCell className="font-medium">{account.name}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {account.notes ?? "—"}
              </TableCell>
              <TableCell className="text-center">
                <Switch
                  checked={account.active}
                  disabled={pending}
                  onCheckedChange={(checked) => toggleActive(account.id, checked)}
                />
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={pending}
                  onClick={() => remove(account.id)}
                >
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
