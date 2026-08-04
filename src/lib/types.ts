export type TagRef = { id: string; name: string }

export type PaymentMethod = "CASH" | "PIX" | "TRANSFER" | "BOLETO" | "CARD" | "OTHER"

export type SerializedIncomeEntry = {
  id: string
  name: string
  amount: number
  dueDay: number | null
  dueDayType: "CALENDAR_DAY" | "BUSINESS_DAY"
  dueDate: string | null
  received: boolean
  isRecurring: boolean
  uncertain: boolean
  tags: TagRef[]
  importedFromPluggy: boolean
}

export type SerializedExpenseEntry = {
  id: string
  name: string
  amount: number
  category: "FIXED" | "VARIABLE" | "ONE_OFF"
  dueDay: number | null
  dueDayType: "CALENDAR_DAY" | "BUSINESS_DAY"
  dueDate: string | null
  paid: boolean
  paidBy: "SELF" | "THIRD_PARTY"
  paidByName: string | null
  isRecurring: boolean
  uncertain: boolean
  tags: TagRef[]
  paymentMethod: PaymentMethod
  pixKeyId: string | null
  pixKeyLabel: string | null
  externalLink: string | null
  attachmentFileName: string | null
  hasAttachment: boolean
  importedFromPluggy: boolean
}

export type SerializedCardSummary = {
  id: string
  name: string
  accountId: string | null
  accountName: string | null
  total: number
  paid: boolean
  closingDay: number | null
  bestPurchaseDay: number | null
  paymentDay: number | null
  cardNumber: string | null
}

export type SerializedSubscription = {
  id: string
  name: string
  amount: number
  currency: "BRL" | "USD"
  originalAmount: number | null
  exchangeRate: number | null
  paymentMethod: PaymentMethod
  cardId: string | null
  cardName: string | null
  active: boolean
  chargeDay: number
  logoDomain: string | null
  startMonth: string
  cancelledAt: string | null
  tags: TagRef[]
}

export type SerializedCardPurchase = {
  id: string
  description: string
  totalAmount: number
  installmentAmount: number
  remainingAmount: number
  purchaseDate: string
  billingMonth: string
  installmentCount: number
  currentInstallmentNo: number | null
  hasInterest: boolean
  paidInstallments: number
  remainingInstallments: number
  tags: TagRef[]
  importedFromPluggy: boolean
  /** Present when this row is a subscription charge on the invoice, not a purchase. */
  subscription?: {
    subscriptionId: string
    logoDomain: string | null
    cancelled: boolean
  }
}

export type SerializedPluggyAccountLink = {
  id: string
  pluggyAccountId: string
  type: "BANK" | "CREDIT"
  name: string
  numberLast4: string | null
  accountId: string | null
  accountName: string | null
  cardId: string | null
  cardName: string | null
  includeInBalance: boolean
  lastBalance: number | null
  lastBalanceAt: string | null
  suggestedCardId: string | null
  suggestedAccountId: string | null
}

export type SerializedPluggyConnection = {
  id: string
  itemId: string
  connectorName: string
  connectorImageUrl: string | null
  status: string
  executionStatus: string | null
  lastSyncedAt: string | null
  accountLinks: SerializedPluggyAccountLink[]
}
