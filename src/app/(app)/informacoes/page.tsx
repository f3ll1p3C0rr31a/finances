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
    </div>
  )
}
