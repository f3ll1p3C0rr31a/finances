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
}

export type SerializedSubscription = {
  id: string
  name: string
  amount: number
  paymentMethod: PaymentMethod
  cardId: string | null
  cardName: string | null
  active: boolean
  startMonth: string
  cancelledMonth: string | null
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
}
