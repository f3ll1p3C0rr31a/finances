const PLUGGY_API_URL = "https://api.pluggy.ai"

export type PluggyItem = {
  id: string
  connector: { id: number; name: string; imageUrl?: string | null }
  status: string
  executionStatus?: string | null
}

export type PluggyAccount = {
  id: string
  type: "BANK" | "CREDIT"
  subtype: string | null
  name: string
  number: string | null
  balance: number
  currencyCode: string
  creditData?: {
    creditLimit?: number | null
    availableCreditLimit?: number | null
    balanceDueDate?: string | null
    brand?: string | null
  } | null
}

export type PluggyTransaction = {
  id: string
  description: string
  amount: number
  date: string
  category?: string | null
  type: "DEBIT" | "CREDIT"
  status?: "POSTED" | "PENDING" | null
  creditCardMetadata?: {
    installmentNumber?: number | null
    totalInstallments?: number | null
    billId?: string | null
  } | null
}

type TransactionsPage = {
  results: PluggyTransaction[]
  next: string | null
}

/**
 * The API key is a short-lived JWT (~2h). It is cached in module scope and
 * refreshed on demand, mirroring how src/lib/prisma.ts keeps a singleton, so
 * a burst of syncs doesn't re-authenticate on every call.
 */
let cachedApiKey: { value: string; fetchedAt: number } | null = null
const API_KEY_TTL_MS = 90 * 60 * 1000

function requireCredentials() {
  const clientId = process.env.PLUGGY_CLIENT_ID
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error("PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET não estão configurados")
  }
  return { clientId, clientSecret }
}

async function authenticate(): Promise<string> {
  const { clientId, clientSecret } = requireCredentials()
  const response = await fetch(`${PLUGGY_API_URL}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  })
  if (!response.ok) {
    throw new Error(`Falha ao autenticar no Pluggy (${response.status})`)
  }
  const data = (await response.json()) as { apiKey: string }
  cachedApiKey = { value: data.apiKey, fetchedAt: Date.now() }
  return data.apiKey
}

async function getApiKey(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedApiKey && Date.now() - cachedApiKey.fetchedAt < API_KEY_TTL_MS) {
    return cachedApiKey.value
  }
  return authenticate()
}

async function pluggyFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const send = async (apiKey: string) =>
    fetch(`${PLUGGY_API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
        ...init.headers,
      },
      cache: "no-store",
    })

  let response = await send(await getApiKey())
  if (response.status === 401 || response.status === 403) {
    response = await send(await getApiKey(true))
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(`Pluggy ${path} falhou (${response.status}): ${body.slice(0, 200)}`)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export function pluggyIsConfigured(): boolean {
  return Boolean(process.env.PLUGGY_CLIENT_ID && process.env.PLUGGY_CLIENT_SECRET)
}

/**
 * Short-lived token (30 min) handed to the Connect widget in the browser.
 * Passing `itemId` puts the widget in update mode, to re-authenticate an
 * existing connection instead of creating a duplicate one.
 */
export async function createConnectToken(options: {
  clientUserId: string
  itemId?: string
  webhookUrl?: string
}): Promise<string> {
  const data = await pluggyFetch<{ accessToken: string }>("/connect_token", {
    method: "POST",
    body: JSON.stringify({
      itemId: options.itemId,
      options: {
        clientUserId: options.clientUserId,
        webhookUrl: options.webhookUrl,
        avoidDuplicates: true,
      },
    }),
  })
  return data.accessToken
}

export async function getItem(itemId: string): Promise<PluggyItem> {
  return pluggyFetch<PluggyItem>(`/items/${itemId}`)
}

export async function deleteItem(itemId: string): Promise<void> {
  await pluggyFetch<void>(`/items/${itemId}`, { method: "DELETE" })
}

export async function listAccounts(itemId: string): Promise<PluggyAccount[]> {
  const data = await pluggyFetch<{ results: PluggyAccount[] }>(
    `/accounts?itemId=${encodeURIComponent(itemId)}`
  )
  return data.results
}

/** Re-fetch a little before the watermark so a transaction that landed at
 *  Pluggy while a sync was running is never skipped. Duplicates are harmless:
 *  PluggyImportedTransaction.pluggyTransactionId is unique. */
const SYNC_OVERLAP_MS = 24 * 60 * 60 * 1000

/**
 * All transactions of an account created after `syncedAt`, following Pluggy's
 * page cursor until exhausted. `syncedAt` null pulls the full history (first
 * sync of that account).
 */
export async function listTransactionsSince(
  accountId: string,
  syncedAt?: Date | null
): Promise<PluggyTransaction[]> {
  const transactions: PluggyTransaction[] = []
  const baseQuery = new URLSearchParams({ accountId, pageSize: "500" })
  if (syncedAt) {
    baseQuery.set("createdAtFrom", new Date(syncedAt.getTime() - SYNC_OVERLAP_MS).toISOString())
  }

  let cursor: string | null = null
  for (;;) {
    const query = new URLSearchParams(baseQuery)
    if (cursor) query.set("after", cursor)
    const page: TransactionsPage = await pluggyFetch<TransactionsPage>(
      `/v2/transactions?${query.toString()}`
    )
    transactions.push(...page.results)

    if (!page.next || page.next === cursor) break
    cursor = page.next
  }

  return transactions
}

export async function registerWebhook(url: string, secret: string): Promise<void> {
  await pluggyFetch<unknown>("/webhooks", {
    method: "POST",
    body: JSON.stringify({
      event: "all",
      url,
      headers: { authorization: `Bearer ${secret}` },
    }),
  })
}

export async function listWebhooks(): Promise<{ id: string; url: string; event: string }[]> {
  const data = await pluggyFetch<{ results: { id: string; url: string; event: string }[] }>(
    "/webhooks"
  )
  return data.results
}

export async function deleteWebhook(id: string): Promise<void> {
  await pluggyFetch<void>(`/webhooks/${id}`, { method: "DELETE" })
}
