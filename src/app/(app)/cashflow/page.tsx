import { redirect } from "next/navigation"

import { currentMonth, monthKeyFromDate } from "@/lib/calculations/month"

export default function CashflowIndexRedirect() {
  redirect(`/dashboard/${monthKeyFromDate(currentMonth())}`)
}
