"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
  removePluggyConnection,
  setAccountLinkIncludeInBalance,
  syncPluggyConnectionAction,
  unlinkPluggyAccount,
} from "@/lib/actions/pluggy"
import { formatCurrency } from "@/lib/calculations/format"
import type { SerializedPluggyConnection } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ConnectBankButton } from "@/components/conexoes/connect-bank-button"
import { LinkAccountDialog } from "@/components/conexoes/link-account-dialog"

type Option = { id: string; name: string }

/** Pluggy item statuses that mean the connection needs the user's attention. */
const BROKEN_STATUSES = new Set(["LOGIN_ERROR", "WAITING_USER_INPUT", "OUTDATED", "ERROR"])

function formatDateTime(iso: string | null): string {
  if (!iso) return "nunca"
  return new Date(iso).toLocaleString("pt-BR")
}

export function ConnectionList({
  connections,
  accounts,
  cards,
}: {
  connections: SerializedPluggyConnection[]
  accounts: Option[]
  cards: Option[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  if (connections.length === 0) {
    return (
      <p className="text-muted-foreground">
        Nenhum banco conectado ainda. Use “Conectar banco” para começar.
      </p>
    )
  }

  function sync(connectionId: string) {
    startTransition(async () => {
      try {
        const result = await syncPluggyConnectionAction(connectionId)
        const imported = result.expenses + result.incomes + result.cardPurchases
        toast.success(
          imported > 0
            ? `${imported} lançamento(s) importado(s): ${result.expenses} despesas, ${result.incomes} entradas, ${result.cardPurchases} compras.`
            : "Tudo em dia — nenhum lançamento novo."
        )
        router.refresh()
      } catch {
        toast.error("Não foi possível sincronizar agora.")
      }
    })
  }

  function remove(connectionId: string) {
    startTransition(async () => {
      try {
        await removePluggyConnection(connectionId)
        toast.success("Conexão removida e acesso revogado no banco.")
        router.refresh()
      } catch {
        toast.error("Não foi possível remover a conexão.")
      }
    })
  }

  function unlink(linkId: string) {
    startTransition(async () => {
      try {
        await unlinkPluggyAccount(linkId)
        toast.success("Vínculo desfeito. Essa conta para de importar.")
        router.refresh()
      } catch {
        toast.error("Não foi possível desfazer o vínculo.")
      }
    })
  }

  function toggleBalance(linkId: string, include: boolean) {
    startTransition(async () => {
      try {
        await setAccountLinkIncludeInBalance(linkId, include)
        router.refresh()
      } catch {
        toast.error("Não foi possível alterar essa opção.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {connections.map((connection) => {
        const needsAttention = BROKEN_STATUSES.has(connection.status)
        return (
          <Card key={connection.id}>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                {connection.connectorImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- remote bank logo from Pluggy
                  <img
                    src={connection.connectorImageUrl}
                    alt=""
                    className="size-8 rounded-lg bg-white object-contain p-0.5 ring-1 ring-black/10"
                  />
                ) : null}
                <div>
                  <CardTitle>{connection.connectorName}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Última sincronização: {formatDateTime(connection.lastSyncedAt)}
                  </p>
                </div>
                {needsAttention ? (
                  <Badge variant="destructive">{connection.status}</Badge>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {needsAttention ? (
                  <ConnectBankButton
                    itemId={connection.itemId}
                    label="Reconectar"
                    variant="outline"
                    size="sm"
                  />
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => sync(connection.id)}
                >
                  {pending ? "Sincronizando..." : "Sincronizar agora"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => remove(connection.id)}
                >
                  Remover
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {connection.accountLinks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma conta encontrada nesta conexão.
                </p>
              ) : (
                connection.accountLinks.map((link) => {
                  const linked = Boolean(link.accountId ?? link.cardId)
                  return (
                    <div
                      key={link.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                    >
                      <div className="min-w-48">
                        <p className="text-sm font-medium">
                          {link.name}
                          {link.numberLast4 ? (
                            <span className="ml-2 font-mono text-xs text-muted-foreground">
                              •••• {link.numberLast4}
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {link.type === "CREDIT" ? "Cartão de crédito" : "Conta bancária"}
                          {link.lastBalance != null
                            ? ` · saldo no banco: ${formatCurrency(link.lastBalance)}`
                            : ""}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        {link.type === "BANK" && linked ? (
                          <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Switch
                              checked={link.includeInBalance}
                              onCheckedChange={(checked) => toggleBalance(link.id, checked)}
                            />
                            Somar no Saldo Atual
                          </label>
                        ) : null}

                        {linked ? (
                          <>
                            <Badge variant="secondary">
                              {link.cardName ?? link.accountName}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="xs"
                              disabled={pending}
                              onClick={() => unlink(link.id)}
                            >
                              Desvincular
                            </Button>
                          </>
                        ) : (
                          <LinkAccountDialog
                            link={link}
                            connectionId={connection.id}
                            accounts={accounts}
                            cards={cards}
                          />
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
