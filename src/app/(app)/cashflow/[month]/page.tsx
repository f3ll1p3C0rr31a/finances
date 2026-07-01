import { redirect } from "next/navigation"

const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/

export default async function CashflowMonthRedirect({
  params,
}: {
  params: Promise<{ month: string }>
}) {
  const { month: monthKey } = await params
  redirect(MONTH_KEY_PATTERN.test(monthKey) ? `/dashboard/${monthKey}` : "/dashboard")
}
