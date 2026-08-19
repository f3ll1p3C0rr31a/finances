import { Prisma } from "@/generated/prisma/client"

import { prisma } from "@/lib/prisma"
import { resolveDueDate, type DueDayType } from "@/lib/calculations/businessDay"
import { currentMonth } from "@/lib/calculations/month"

/**
 * Herança de lançamentos recorrentes.
 *
 * Uma conta recorrente (aluguel, van escolar, luz) tende a manter as mesmas
 * características mês a mês, então o mês novo nasce copiando o mês anterior em
 * vez dos valores congelados no template — o template só entra quando não há
 * nenhum mês anterior. Assim, mudar o valor da van em agosto vale para
 * setembro em diante sem precisar repetir a edição.
 *
 * Um mês encerrado é histórico e nunca é reescrito. Um lançamento já pago
 * também não: o pagamento já mexeu no saldo real, e alterar o valor por baixo
 * deixaria a conta inconsistente.
 *
 * Cartões ficam de fora de propósito: a fatura muda de valor todo mês e é
 * calculada a partir das compras, não herdada.
 */

/** Campos que descrevem a conta e se repetem; o resto é estado do mês. */
const EXPENSE_TRAITS = [
  "name",
  "category",
  "amount",
  "dueDayType",
  "dueDayValue",
  "paidBy",
  "paidByName",
  "paymentMethod",
  "pixKeyId",
  "externalLink",
] as const

const INCOME_TRAITS = ["name", "amount", "dueDayType", "dueDayValue"] as const

type ExpenseTraits = Pick<Prisma.ExpenseEntryUncheckedCreateInput, (typeof EXPENSE_TRAITS)[number]>
type IncomeTraits = Pick<Prisma.IncomeEntryUncheckedCreateInput, (typeof INCOME_TRAITS)[number]>

/**
 * Meses que ainda podem herdar uma alteração feita em `editedMonth`: os
 * posteriores a ele que também não estão encerrados. Editar um mês passado
 * corrige aquele mês, mas não reescreve os meses fechados que vieram depois.
 */
function inheritingMonths(editedMonth: Date) {
  return { gt: editedMonth, gte: currentMonth() }
}

function dueDateFor(
  month: Date,
  traits: { dueDayType?: DueDayType | null; dueDayValue?: number | null }
) {
  if (!traits.dueDayValue) return null
  return resolveDueDate(month, traits.dueDayType ?? "CALENDAR_DAY", traits.dueDayValue)
}

/**
 * Propaga as características de uma despesa recorrente para os meses seguintes
 * ainda abertos. `dueDate` é recalculado mês a mês porque dia útil cai em datas
 * diferentes em cada um.
 */
export async function propagateExpenseTraits(
  userId: string,
  entry: { id: string; templateId: string | null; month: Date } & ExpenseTraits
): Promise<number> {
  if (!entry.templateId) return 0

  const targets = await prisma.expenseEntry.findMany({
    where: {
      userId,
      templateId: entry.templateId,
      month: inheritingMonths(entry.month),
      paid: false,
    },
    select: { id: true, month: true },
  })

  const traits = Object.fromEntries(EXPENSE_TRAITS.map((key) => [key, entry[key]])) as ExpenseTraits

  await prisma.$transaction(
    targets.map((target) =>
      prisma.expenseEntry.update({
        where: { id: target.id },
        data: { ...traits, dueDate: dueDateFor(target.month, entry) },
      })
    )
  )

  return targets.length
}

export async function propagateIncomeTraits(
  userId: string,
  entry: { id: string; templateId: string | null; month: Date } & IncomeTraits
): Promise<number> {
  if (!entry.templateId) return 0

  const targets = await prisma.incomeEntry.findMany({
    where: {
      userId,
      templateId: entry.templateId,
      month: inheritingMonths(entry.month),
      received: false,
    },
    select: { id: true, month: true },
  })

  const traits = Object.fromEntries(INCOME_TRAITS.map((key) => [key, entry[key]])) as IncomeTraits

  await prisma.$transaction(
    targets.map((target) =>
      prisma.incomeEntry.update({
        where: { id: target.id },
        data: { ...traits, dueDate: dueDateFor(target.month, entry) },
      })
    )
  )

  return targets.length
}

/**
 * Espelha as etiquetas de um lançamento recorrente nos meses seguintes ainda
 * abertos: sem isso, o gráfico de gastos por etiqueta perderia a conta a partir
 * do mês seguinte, já que ele ignora lançamentos sem etiqueta.
 */
export async function propagateExpenseTags(
  userId: string,
  entry: { templateId: string | null; month: Date },
  tagIds: string[]
): Promise<void> {
  if (!entry.templateId) return

  const targets = await prisma.expenseEntry.findMany({
    where: {
      userId,
      templateId: entry.templateId,
      month: inheritingMonths(entry.month),
      paid: false,
    },
    select: { id: true },
  })
  if (targets.length === 0) return

  const ids = targets.map((target) => target.id)
  await prisma.$transaction([
    prisma.expenseEntryTag.deleteMany({ where: { entryId: { in: ids } } }),
    prisma.expenseEntryTag.createMany({
      data: ids.flatMap((entryId) => tagIds.map((tagId) => ({ entryId, tagId }))),
    }),
  ])
}

export async function propagateIncomeTags(
  userId: string,
  entry: { templateId: string | null; month: Date },
  tagIds: string[]
): Promise<void> {
  if (!entry.templateId) return

  const targets = await prisma.incomeEntry.findMany({
    where: {
      userId,
      templateId: entry.templateId,
      month: inheritingMonths(entry.month),
      received: false,
    },
    select: { id: true },
  })
  if (targets.length === 0) return

  const ids = targets.map((target) => target.id)
  await prisma.$transaction([
    prisma.incomeEntryTag.deleteMany({ where: { entryId: { in: ids } } }),
    prisma.incomeEntryTag.createMany({
      data: ids.flatMap((entryId) => tagIds.map((tagId) => ({ entryId, tagId }))),
    }),
  ])
}

/**
 * Dados para materializar o mês `month` de uma despesa recorrente: copia o mês
 * anterior mais recente e, se ele não existir, cai nos valores do template.
 */
export async function expenseSeedForMonth(
  userId: string,
  template: {
    id: string
    name: string
    category: Prisma.ExpenseEntryUncheckedCreateInput["category"]
    defaultAmount: Prisma.Decimal | null
    dayOfMonth: number | null
    dueDayType: Prisma.ExpenseEntryUncheckedCreateInput["dueDayType"]
  },
  month: Date
): Promise<Prisma.ExpenseEntryUncheckedCreateInput> {
  const previous = await prisma.expenseEntry.findFirst({
    where: { userId, templateId: template.id, month: { lt: month } },
    orderBy: { month: "desc" },
    include: { tags: { select: { tagId: true } } },
  })

  const traits: ExpenseTraits = previous
    ? (Object.fromEntries(EXPENSE_TRAITS.map((key) => [key, previous[key]])) as ExpenseTraits)
    : {
        name: template.name,
        category: template.category,
        amount: template.defaultAmount ?? new Prisma.Decimal(0),
        dueDayType: template.dueDayType,
        dueDayValue: template.dayOfMonth,
      }

  return {
    userId,
    templateId: template.id,
    month,
    ...traits,
    dueDate: dueDateFor(month, traits),
    ...(previous && previous.tags.length > 0
      ? { tags: { createMany: { data: previous.tags.map(({ tagId }) => ({ tagId })) } } }
      : {}),
  }
}

export async function incomeSeedForMonth(
  userId: string,
  template: {
    id: string
    name: string
    defaultAmount: Prisma.Decimal
    dayOfMonth: number | null
    dueDayType: Prisma.IncomeEntryUncheckedCreateInput["dueDayType"]
  },
  month: Date
): Promise<Prisma.IncomeEntryUncheckedCreateInput> {
  const previous = await prisma.incomeEntry.findFirst({
    where: { userId, templateId: template.id, month: { lt: month } },
    orderBy: { month: "desc" },
    include: { tags: { select: { tagId: true } } },
  })

  const traits: IncomeTraits = previous
    ? (Object.fromEntries(INCOME_TRAITS.map((key) => [key, previous[key]])) as IncomeTraits)
    : {
        name: template.name,
        amount: template.defaultAmount,
        dueDayType: template.dueDayType,
        dueDayValue: template.dayOfMonth,
      }

  return {
    userId,
    templateId: template.id,
    month,
    ...traits,
    dueDate: dueDateFor(month, traits),
    ...(previous && previous.tags.length > 0
      ? { tags: { createMany: { data: previous.tags.map(({ tagId }) => ({ tagId })) } } }
      : {}),
  }
}
