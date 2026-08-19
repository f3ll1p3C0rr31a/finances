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
  /** Mês (AAAA-MM) da fatura cujo total está em `total`. */
  invoiceMonth: string
  invoiceMonthLabel: string
  /** A fatura exibida ainda está acumulando compras (não fechou). */
  invoiceOpen: boolean
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
  /** Present when this row is a subscription charge on the invoice, not a purchase. */
  subscription?: {
    subscriptionId: string
    logoDomain: string | null
    cancelled: boolean
  }
}
