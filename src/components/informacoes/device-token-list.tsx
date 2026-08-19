"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { issueDeviceToken, revokeDeviceTokenAction } from "@/lib/actions/deviceTokens"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type DeviceToken = {
  id: string
  name: string
  createdAt: string
  lastUsedAt: string | null
}

export function DeviceTokenList({ tokens }: { tokens: DeviceToken[] }) {
  const [name, setName] = useState("")
  // Guardado só em memória: depois de sair da tela não há como recuperar.
  const [issued, setIssued] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function issue() {
    startTransition(async () => {
      try {
        const { token } = await issueDeviceToken(name)
        setIssued(token)
        setName("")
      } catch {
        toast.error("Não foi possível gerar o token.")
      }
    })
  }

  function revoke(id: string) {
    startTransition(async () => {
      try {
        await revokeDeviceTokenAction(id)
        toast.success("Token revogado.")
      } catch {
        toast.error("Não foi possível revogar.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        O widget do Android não consegue usar a sua sessão do navegador, então ele entra com
        um token próprio. Gere um por aparelho: revogar um não derruba os outros nem o seu
        login aqui.
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="device-name">Nome do dispositivo</Label>
          <Input
            id="device-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Celular"
            className="max-w-56"
          />
        </div>
        <Button onClick={issue} disabled={pending || name.trim().length === 0} size="sm">
          Gerar token
        </Button>
      </div>

      {issued ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
            Copie agora — este valor não aparece de novo.
          </p>
          <code className="mt-2 block break-all rounded bg-background/70 p-2 font-mono text-xs">
            {issued}
          </code>
          <div className="mt-2 flex gap-2">
            <Button
              size="xs"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(issued)
                toast.success("Token copiado.")
              }}
            >
              Copiar
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setIssued(null)}>
              Já guardei
            </Button>
          </div>
        </div>
      ) : null}

      {tokens.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum dispositivo autorizado.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tokens.map((token) => (
            <li
              key={token.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
            >
              <div>
                <p className="text-sm font-medium">{token.name}</p>
                <p className="text-xs text-muted-foreground">
                  Criado em {new Date(token.createdAt).toLocaleDateString("pt-BR")}
                  {token.lastUsedAt
                    ? ` · último uso em ${new Date(token.lastUsedAt).toLocaleString("pt-BR")}`
                    : " · nunca usado"}
                </p>
              </div>
              <Button
                size="xs"
                variant="ghost"
                disabled={pending}
                onClick={() => revoke(token.id)}
              >
                Revogar
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
