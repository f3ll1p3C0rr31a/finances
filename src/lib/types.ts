export type SerializedIncomeEntry = {
  id: string
  name: string
  amount: number
  dueDay: number | null
  received: boolean
  isRecurring: boolean
}

export type SerializedExpenseEntry = {
  id: string
  name: string
  amount: number
  category: "FIXED" | "VARIABLE" | "ONE_OFF"
  dueDay: number | null
  paid: boolean
  paidBy: "SELF" | "THIRD_PARTY"
  paidByName: string | null
  isRecurring: boolean
}

export type SerializedCardSummary = {
  id: string
  name: string
  total: number
}

export type SerializedCardPurchase = {
  id: string
  description: string
  totalAmount: number
  purchaseDate: string
  installmentCount: number
}
