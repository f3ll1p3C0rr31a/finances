import { requireUserId } from "@/lib/session"
import { listAccounts } from "@/lib/actions/accounts"
import { listPixKeys } from "@/lib/actions/pixKeys"
import { listDeviceTokens } from "@/lib/services/deviceTokens"
import { AccountList } from "@/components/informacoes/account-list"
import { NewAccountDialog } from "@/components/informacoes/new-account-dialog"
import { PixKeyList } from "@/components/informacoes/pix-key-list"
import { NewPixKeyDialog } from "@/components/informacoes/new-pix-key-dialog"
import { DeviceTokenList } from "@/components/informacoes/device-token-list"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function InformacoesPage() {
  const userId = await requireUserId()
  const [accounts, ownKeys, payeeKeys, deviceTokens] = await Promise.all([
    listAccounts(userId),
    listPixKeys(userId, "OWN"),
    listPixKeys(userId, "PAYEE"),
    listDeviceTokens(userId),
  ])
  const accountOptions = accounts.map((account) => ({ id: account.id, name: account.name }))

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Informações</h1>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Contas</CardTitle>
          <NewAccountDialog />
        </CardHeader>
        <CardContent>
          <AccountList accounts={accounts} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Minhas chaves Pix</CardTitle>
          <NewPixKeyDialog kind="OWN" accounts={accountOptions} />
        </CardHeader>
        <CardContent>
          <PixKeyList pixKeys={ownKeys} accounts={accountOptions} kind="OWN" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Pagamentos frequentes (Pix de terceiros)</CardTitle>
          <NewPixKeyDialog kind="PAYEE" accounts={accountOptions} />
        </CardHeader>
        <CardContent>
          <PixKeyList pixKeys={payeeKeys} accounts={accountOptions} kind="PAYEE" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dispositivos (widget do Android)</CardTitle>
        </CardHeader>
        <CardContent>
          <DeviceTokenList
            tokens={deviceTokens.map((token) => ({
              id: token.id,
              name: token.name,
              createdAt: token.createdAt.toISOString(),
              lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
