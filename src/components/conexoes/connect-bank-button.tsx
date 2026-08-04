"use client"

import { useState, useTransition } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { createPluggyConnectToken, finalizePluggyConnection } from "@/lib/actions/pluggy"
import { Button } from "@/components/ui/button"

// The widget renders an iframe and touches window on import, so it must stay
// out of the server bundle.
const PluggyConnect = dynamic(
  () => import("react-pluggy-connect").then((mod) => mod.PluggyConnect),
  { ssr: false }
)

export function ConnectBankButton({
  itemId,
  label = "Conectar banco",
  variant = "default",
  size = "default",
}: {
  itemId?: string
  label?: string
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "xs" | "sm"
}) {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function openWidget() {
    startTransition(async () => {
      try {
        setToken(await createPluggyConnectToken(itemId))
      } catch {
        toast.error("Não foi possível iniciar a conexão com o banco.")
      }
    })
  }

  return (
    <>
      <Button variant={variant} size={size} disabled={pending} onClick={openWidget}>
        {pending ? "Abrindo..." : label}
      </Button>
      {token ? (
        <PluggyConnect
          connectToken={token}
          updateItem={itemId}
          includeSandbox
          onSuccess={async ({ item }) => {
            setToken(null)
            try {
              await finalizePluggyConnection(item)
              toast.success("Banco conectado. Vincule as contas para começar a importar.")
              router.refresh()
            } catch {
              toast.error("Conectado no banco, mas falhou ao salvar a conexão.")
            }
          }}
          onError={() => {
            setToken(null)
            toast.error("A conexão com o banco falhou.")
          }}
          onClose={() => setToken(null)}
        />
      ) : null}
    </>
  )
}
