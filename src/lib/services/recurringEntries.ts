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
 * A propagação é seletiva: um mês futuro só recebe o campo alterado se ainda
 * estiver com o valor antigo, ou seja, se estava apenas herdando. Um mês que
 * você ajustou de propósito sobrevive à edição dos meses anteriores. A
 * comparação é campo a campo, então mudar quem paga a conta alcança até o mês
 * que tem um valor diferente combinado.
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

function sameTrait(a: unknown, b: unknown): boolean {
  if (a instanceof Prisma.Decimal && b instanceof Prisma.Decimal) return a.equals(b)
  if (a instanceof Prisma.Decimal || b instanceof Prisma.Decimal) {
    // Um lado é Decimal e o outro não é: só são iguais se ambos forem nulos,
    // caso já coberto acima, então aqui a resposta é sempre não.
    return false
  }
  return a === b
}

/**
 * O que um mês futuro deve herdar de uma edição: só os campos que realmente
 * mudaram e que aquele mês ainda mantinha no valor antigo.
 *
 * Comparar contra o valor antigo — e não simplesmente sobrescrever — é o que
 * preserva um mês ajustado de propósito. Comparar campo a campo é o que
 * permite, por exemplo, mudar quem paga a conta sem esbarrar num mês que tem
 * um valor combinado diferente.
 */
export function traitsToInherit<T extends object>(
  previous: T,
  next: T,
  target: T,
  fields: readonly (keyof T)[]
): Partial<T> {
  const changes: Partial<T> = {}
  for (const field of fields) {
    if (sameTrait(previous[field], next[field])) continue
    if (!sameTrait(target[field], previous[field])) continue
    changes[field] = next[field]
  }
  return changes
}

/**
 * Propaga uma edição de despesa recorrente para os meses seguintes ainda
 * abertos. `dueDate` é recalculado por mês porque dia útil cai em datas
 * diferentes em cada um. Devolve quantos meses mudaram.
 */
export async function propagateExpenseTraits(
  userId: string,
  previous: ExpenseTraits,
  next: { templateId: string | null; month: Date } & ExpenseTraits
): Promise<number> {
  if (!next.templateId) return 0

  const targets = await prisma.expenseEntry.findMany({
    where: {
      userId,
      templateId: next.templateId,
      month: inheritingMonths(next.month),
      paid: false,
    },
  })

  const updates = targets.flatMap((target) => {
    const changes = traitsToInherit(previous, next, target, EXPENSE_TRAITS)
    if (Object.keys(changes).length === 0) return []
    const touchesDueDay = "dueDayType" in changes || "dueDayValue" in changes
    return [
      prisma.expenseEntry.update({
        where: { id: target.id },
        data: {
          ...changes,
          ...(touchesDueDay
            ? {
                dueDate: dueDateFor(target.month, {
                  dueDayType: changes.dueDayType ?? target.dueDayType,
                  dueDayValue: changes.dueDayValue ?? target.dueDayValue,
                }),
              }
            : {}),
        },
      }),
    ]
  })

  await prisma.$transaction(updates)
  return updates.length
}

export async function propagateIncomeTraits(
  userId: string,
  previous: IncomeTraits,
  next: { templateId: string | null; month: Date } & IncomeTraits
): Promise<number> {
  if (!next.templateId) return 0

  const targets = await prisma.incomeEntry.findMany({
    where: {
      userId,
      templateId: next.templateId,
      month: inheritingMonths(next.month),
      received: false,
    },
  })

  const updates = targets.flatMap((target) => {
    const changes = traitsToInherit(previous, next, target, INCOME_TRAITS)
    if (Object.keys(changes).length === 0) return []
    const touchesDueDay = "dueDayType" in changes || "dueDayValue" in changes
    return [
      prisma.incomeEntry.update({
        where: { id: target.id },
        data: {
          ...changes,
          ...(touchesDueDay
            ? {
                dueDate: dueDateFor(target.month, {
                  dueDayType: changes.dueDayType ?? target.dueDayType,
                  dueDayValue: changes.dueDayValue ?? target.dueDayValue,
                }),
              }
            : {}),
        },
      }),
    ]
  })

  await prisma.$transaction(updates)
  return updates.length
}

function sameTagSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const sorted = [...b].sort()
  return [...a].sort().every((tagId, index) => tagId === sorted[index])
}

/**
 * Espelha as etiquetas de um lançamento recorrente nos meses seguintes ainda
 * abertos — sem isso o gráfico de gastos por etiqueta perderia a conta a partir
 * do mês seguinte, já que ele ignora lançamentos sem etiqueta.
 *
 * Segue a mesma seletividade dos demais campos: só recebe as etiquetas novas o
 * mês que ainda estava com exatamente o conjunto antigo.
 */
async function propagateTags(
  targets: { id: string; tags: { tagId: string }[] }[],
  previousTagIds: string[],
  nextTagIds: string[],
  replace: (entryIds: string[], tagIds: string[]) => Prisma.PrismaPromise<unknown>[]
): Promise<number> {
  if (sameTagSet(previousTagIds, nextTagIds)) return 0

  const ids = targets
    .filter((target) => sameTagSet(target.tags.map(({ tagId }) => tagId), previousTagIds))
    .map((target) => target.id)
  if (ids.length === 0) return 0

  await prisma.$transaction(replace(ids, nextTagIds))
  return ids.length
}

export async function propagateExpenseTags(
  userId: string,
  entry: { templateId: string | null; month: Date },
  previousTagIds: string[],
  nextTagIds: string[]
): Promise<number> {
  if (!entry.templateId) return 0

  const targets = await prisma.expenseEntry.findMany({
    where: {
      userId,
      templateId: entry.templateId,
      month: inheritingMonths(entry.month),
      paid: false,
    },
    select: { id: true, tags: { select: { tagId: true } } },
  })

  return propagateTags(targets, previousTagIds, nextTagIds, (entryIds, tagIds) => [
    prisma.expenseEntryTag.deleteMany({ where: { entryId: { in: entryIds } } }),
    prisma.expenseEntryTag.createMany({
      data: entryIds.flatMap((entryId) => tagIds.map((tagId) => ({ entryId, tagId }))),
    }),
  ])
}

export async function propagateIncomeTags(
  userId: string,
  entry: { templateId: string | null; month: Date },
  previousTagIds: string[],
  nextTagIds: string[]
): Promise<number> {
  if (!entry.templateId) return 0

  const targets = await prisma.incomeEntry.findMany({
    where: {
      userId,
      templateId: entry.templateId,
      month: inheritingMonths(entry.month),
      received: false,
    },
    select: { id: true, tags: { select: { tagId: true } } },
  })

  return propagateTags(targets, previousTagIds, nextTagIds, (entryIds, tagIds) => [
    prisma.incomeEntryTag.deleteMany({ where: { entryId: { in: entryIds } } }),
    prisma.incomeEntryTag.createMany({
      data: entryIds.flatMap((entryId) => tagIds.map((tagId) => ({ entryId, tagId }))),
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
