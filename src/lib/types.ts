export type TagRef = { id: string; name: string }

export type PaymentMethod = "CASH" | "PIX" | "TRANSFER" | "CARD" | "OTHER"

export type SerializedIncomeEntry = {
  id: string
  name: string
  amount: number
  dueDay: number | null
  dueDayType: "CALENDAR_DAY" | "BUSINESS_DAY"
  dueDate: string | null
  received: boolean
  isRecurring: boolean
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
  tags: TagRef[]
  paymentMethod: PaymentMethod
  pixKeyId: string | null
  pixKeyLabel: string | null
}

export type SerializedCardSummary = {
  id: string
  name: string
  total: number
  closingDay: number | null
  bestPurchaseDay: number | null
}

export type SerializedCardPurchase = {
  id: string
  description: string
  totalAmount: number
  purchaseDate: string
  installmentCount: number
  tags: TagRef[]
}
