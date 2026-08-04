import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"
import { listAccounts } from "@/lib/actions/accounts"
import { pluggyIsConfigured } from "@/lib/services/pluggyClient"
import { lastFourDigits } from "@/lib/cardBrand"
import type { SerializedPluggyConnection } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ConnectBankButton } from "@/components/conexoes/connect-bank-button"
import { ConnectionList } from "@/components/conexoes/connection-list"

export default async function ConexoesPage() {
  const userId = await requireUserId()
  const [connections, accounts, cards] = await Promise.all([
    prisma.pluggyConnection.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: {
        accountLinks: {
          orderBy: { name: "asc" },
          include: { account: true, card: true },
        },
      },
    }),
    listAccounts(userId),
    prisma.card.findMany({ where: { userId, active: true }, orderBy: { name: "asc" } }),
  ])

  const accountOptions = accounts.map((account) => ({ id: account.id, name: account.name }))
  const cardOptions = cards.map((card) => ({ id: card.id, name: card.name }))

  const serialized: SerializedPluggyConnection[] = connections.map((connection) => ({
    id: connection.id,
    itemId: connection.itemId,
    connectorName: connection.connectorName,
    connectorImageUrl: connection.connectorImageUrl,
    status: connection.status,
    executionStatus: connection.executionStatus,
    lastSyncedAt: connection.lastSyncedAt ? connection.lastSyncedAt.toISOString() : null,
    accountLinks: connection.accountLinks.map((link) => {
      // Suggest by the last 4 digits the user already stored on the card.
      const matchingCards = link.numberLast4
        ? cards.filter((card) => lastFourDigits(card.cardNumber) === link.numberLast4)
        : []
      const suggestedCardId =
        link.type === "CREDIT" && matchingCards.length === 1 ? matchingCards[0].id : null

      const normalizedName = link.name.toLowerCase()
      const matchingAccounts = accounts.filter((account) =>
        [account.name, account.bankName]
          .filter(Boolean)
          .some((value) => normalizedName.includes(value!.toLowerCase()))
      )
      const suggestedAccountId =
        link.type === "BANK" && matchingAccounts.length === 1 ? matchingAccounts[0].id : null

      return {
        id: link.id,
        pluggyAccountId: link.pluggyAccountId,
        type: link.type,
        name: link.name,
        numberLast4: link.numberLast4,
        accountId: link.accountId,
        accountName: link.account?.name ?? null,
        cardId: link.cardId,
        cardName: link.card?.name ?? null,
        includeInBalance: link.includeInBalance,
        lastBalance: link.lastBalance ? link.lastBalance.toNumber() : null,
        lastBalanceAt: link.lastBalanceAt ? link.lastBalanceAt.toISOString() : null,
        suggestedCardId,
        suggestedAccountId,
      }
    }),
  }))

  const configured = pluggyIsConfigured()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Conexões</h1>
          <p className="text-sm text-muted-foreground">
            Conecte seus bancos para importar lançamentos e saldos automaticamente.
          </p>
        </div>
        {configured ? <ConnectBankButton /> : null}
      </div>

      {!configured ? (
        <Card>
          <CardHeader>
            <CardTitle>Integração não configurada</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Defina <code>PLUGGY_CLIENT_ID</code> e <code>PLUGGY_CLIENT_SECRET</code> no
            ambiente do servidor para habilitar a conexão com bancos.
          </CardContent>
        </Card>
      ) : (
        <ConnectionList
          connections={serialized}
          accounts={accountOptions}
          cards={cardOptions}
        />
      )}
    </div>
  )
}
