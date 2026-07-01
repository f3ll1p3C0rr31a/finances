import { requireUserId } from "@/lib/session"
import { listAccounts } from "@/lib/actions/accounts"
import { listPixKeys } from "@/lib/actions/pixKeys"
import { AccountList } from "@/components/informacoes/account-list"
import { NewAccountDialog } from "@/components/informacoes/new-account-dialog"
import { PixKeyList } from "@/components/informacoes/pix-key-list"
import { NewPixKeyDialog } from "@/components/informacoes/new-pix-key-dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function InformacoesPage() {
  const userId = await requireUserId()
  const [accounts, ownKeys, payeeKeys] = await Promise.all([
    listAccounts(userId),
    listPixKeys(userId, "OWN"),
    listPixKeys(userId, "PAYEE"),
  ])

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
          <NewPixKeyDialog kind="OWN" />
        </CardHeader>
        <CardContent>
          <PixKeyList pixKeys={ownKeys} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Pagamentos frequentes (Pix de terceiros)</CardTitle>
          <NewPixKeyDialog kind="PAYEE" />
        </CardHeader>
        <CardContent>
          <PixKeyList pixKeys={payeeKeys} />
        </CardContent>
      </Card>
    </div>
  )
}
