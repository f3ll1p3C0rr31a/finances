# Arquitetura e regras do domínio

## Fluxo técnico

O App Router usa Server Components por padrão. As páginas autenticadas obtêm a
sessão no servidor, consultam o PostgreSQL via Prisma e serializam valores
`Decimal` e `Date` antes de passá-los aos Client Components interativos.

As mutações ficam em `src/lib/actions/`, normalmente em arquivos com
`"use server"`. Cada ação pública deve:

1. chamar `requireUserId()`;
2. validar a entrada com Zod;
3. conferir que o recurso pertence ao usuário;
4. executar a alteração, usando transação quando houver múltiplas gravações
   inseparáveis;
5. revalidar as rotas afetadas.

Server Functions são endpoints POST alcançáveis diretamente. A presença de uma
UI autenticada não substitui autorização dentro da ação.

## Estrutura

| Caminho | Papel |
| --- | --- |
| `src/app/` | Rotas, layouts e composição de Server Components |
| `src/components/` | UI; diálogos e tabelas interativas são Client Components |
| `src/lib/actions/` | Consultas de domínio e Server Actions |
| `src/lib/calculations/` | Cálculos puros de dinheiro, mês, parcelas e metas |
| `src/lib/validation/` | Schemas Zod e tipos de entrada |
| `src/lib/auth.ts` | Configuração Auth.js |
| `src/lib/session.ts` | Guarda de autenticação server-side |
| `src/lib/prisma.ts` | Cliente Prisma singleton |
| `src/lib/types.ts` | DTOs serializáveis enviados à UI |
| `prisma/schema.prisma` | Modelo relacional |
| `prisma/migrations/` | Histórico do banco |

O alias `@/*` aponta para `src/*`.

## Modelo mental do banco

- `User` é o proprietário de todos os agregados.
- `IncomeTemplate` e `ExpenseTemplate` representam recorrência.
- `IncomeEntry` e `ExpenseEntry` são ocorrências concretas de um mês.
- `MonthlyBalance` forma uma cadeia de saldos mensais.
- `Card` contém `CardPurchase`; compras parceladas materializam
  `CardInstallment`.
- `CardSpendingGoal` é uma meta mensal somando todos os cartões.
- `Subscription` é uma cobrança recorrente sem fim predefinido.
- `Tag` se relaciona N:N com entradas, despesas e compras.
- `Account` e `PixKey` são cadastros auxiliares; uma despesa pode referenciar
  uma chave Pix de favorecido.

## Invariantes financeiras

### Datas e meses

- Um mês é representado por `Date` no primeiro dia do mês, em UTC.
- A URL usa `AAAA-MM`.
- Conversões devem reutilizar `src/lib/calculations/month.ts`.
- Vencimentos usam `CALENDAR_DAY` ou `BUSINESS_DAY`; feriados e dias úteis
  ficam em `businessDay.ts`.

### Dinheiro

- Persistência e cálculo usam `Prisma.Decimal`.
- Não use aritmética de `number` em regras financeiras.
- Converta para `number` apenas ao montar DTOs para componentes.

### Recorrência

- Templates ativos são materializados sob demanda ao abrir um mês.
- A combinação `(templateId, month)` é única.
- `ensureMonthGenerated()` é idempotente e não sobrescreve edições manuais.
- Despesa `ONE_OFF` não deve gerar template recorrente.
- Excluir uma despesa recorrente remove o template e todas as ocorrências
  materializadas; saldos reais previamente ajustados são compensados.

### Pendências incertas

- `IncomeEntry.uncertain` e `ExpenseEntry.uncertain` identificam valores sem
  data certa que não são recorrências.
- Enquanto pendente, o lançamento fica apenas no mês civil atual e é movido
  para o mês seguinte quando o dashboard passa a operar nesse mês.
- Entradas incertas não recebidas e despesas incertas não pagas ficam fora dos
  totais oficiais, do saldo planejado e dos gráficos.
- A prévia de saldo é `saldo planejado + entradas incertas - despesas incertas`.
- Ao marcar como recebido/pago, o lançamento passa a integrar os totais do mês
  em que foi liquidado, deixa a prévia pendente e não avança mais.
- Pendência incerta e template recorrente são conceitos mutuamente exclusivos.

### Cadeia de saldo

- `openingBalance` vem do fechamento do mês anterior.
- Se `actualBalance` existir, ele é a fonte de verdade para o próximo mês.
- Sem saldo real, o fechamento planejado é
  `abertura + entradas - despesas`.
- Despesas totais incluem lançamentos, cartões e assinaturas fora de cartão.
- Alterações que afetam um mês materializado podem exigir
  `recalcOpeningBalanceChain()`.
- Marcar uma entrada recebida ou despesa paga ajusta o Saldo Atual.
- Na interface, `actualBalance` é apresentado como “Saldo Atual”. Recebimentos
  somam, pagamentos subtraem e desmarcar aplica o movimento inverso.
- Se o Saldo Atual ainda não existir, o primeiro movimento parte de
  `openingBalance`; ele nunca deve ser silenciosamente ignorado.

### Cartões

- Compra à vista conta no mês de `purchaseDate`.
- Compra parcelada cria todas as parcelas antecipadamente.
- No modo `TOTAL`, o valor é dividido e eventual centavo residual vai para a
  última parcela.
- No modo `INSTALLMENT`, o valor digitado é o de cada parcela; o total é a
  multiplicação pela quantidade.
- Assinatura com `paymentMethod=CARD` entra no total mensal daquele cartão.
- A meta de cartões compara o total combinado dos cartões ativos.
- Enquanto as faturas somadas estiverem abaixo da meta mensal, a diferença é
  tratada como reserva de despesa prevista. Portanto, o planejamento usa
  `max(total das faturas, meta)`; ao gastar no cartão, a fatura cresce e a
  reserva cai na mesma proporção.
- No dashboard, cada cartão ativo aparece no topo de Despesas como uma linha
  variável calculada. Essa linha é apenas uma representação da fatura já
  incluída nos totais, não um `ExpenseEntry` duplicado.
- `CardInvoicePayment` guarda o estado pago por cartão e mês. Ao marcar uma
  fatura como paga, seu total é descontado do saldo real e salvo em
  `paidAmount`; desmarcar reverte exatamente esse valor.

### Assinaturas

- Uma assinatura vale desde `startMonth`.
- Cancelamento no mês X ainda cobra X; deixa de contar depois de X.
- Reativar remove `cancelledMonth`.

## Convenções Next.js 16 deste projeto

- Consulte `node_modules/next/dist/docs/` antes de alterar APIs do framework.
- `params` de rotas dinâmicas é uma `Promise` e deve ser aguardado.
- Mantenha páginas/layouts como Server Components; use `"use client"` na menor
  fronteira interativa possível.
- `next.config.ts` não habilita `cacheComponents`; não copie exemplos do novo
  modelo de cache sem antes decidir e documentar essa migração.
- Após mutações, preserve o padrão atual de `revalidatePath`.

## Autenticação e isolamento

Auth.js usa Credentials, bcrypt e JWT. O `userId` é copiado para token e sessão.
Toda consulta ou mutação de dado privado deve filtrar por `userId`, diretamente
ou por uma relação cuja propriedade seja verificada. Nunca confie em IDs
recebidos do cliente sem conferir propriedade.
