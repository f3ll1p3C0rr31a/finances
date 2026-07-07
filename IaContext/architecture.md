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
  `CardInstallment`. `CardPurchase.billingMonth` representa a fatura em que a
  compra começa a ser cobrada.
- `CardSpendingGoal` é uma meta mensal somando todos os cartões.
- A meta efetiva de cartões de um mês é a última `CardSpendingGoal` cadastrada
  naquele mês ou antes dele. Ao salvar uma meta em M, metas futuras explícitas
  são removidas para que M passe a valer para M e todos os meses seguintes,
  sem alterar meses anteriores.
- `Subscription` é uma cobrança recorrente sem fim predefinido.
- `Tag` se relaciona N:N com entradas, despesas, compras e assinaturas.
- `Account` representa banco/conta com dados como banco, agência, número, tipo
  e titular. `PixKey` e `Card` podem se vincular a uma `Account`; uma despesa
  pode referenciar uma chave Pix de favorecido.
- `PaymentMethod` aceita `CASH`, `PIX`, `TRANSFER`, `BOLETO`, `CARD` e
  `OTHER`.

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
- A interface também mostra valores futuros/em aberto: entradas ainda não
  recebidas e saídas ainda não pagas. Saídas futuras somam despesas em aberto,
  faturas de cartões não pagas, reserva da meta e assinaturas fora de cartão.
- Alterações que afetam um mês materializado podem exigir
  `recalcOpeningBalanceChain()`.
- Marcar uma entrada recebida ou despesa paga ajusta o Saldo Atual.
- Na interface, `actualBalance` é apresentado como “Saldo Atual”. Recebimentos
  somam, pagamentos subtraem e desmarcar aplica o movimento inverso.
- Se o Saldo Atual ainda não existir, o primeiro movimento parte de
  `openingBalance`; ele nunca deve ser silenciosamente ignorado.

### Cartões

- Compra à vista conta no `billingMonth`, não necessariamente no mês civil de
  `purchaseDate`.
- Compra parcelada cria todas as parcelas antecipadamente a partir do
  `billingMonth`.
- `billingMonth` é calculado por `invoiceMonthForPurchase()`: sem
  `closingDay`, usa o mês da compra; com fechamento, compras no dia de
  fechamento ou antes ficam na fatura do próprio mês, e compras depois do
  fechamento começam na fatura do mês seguinte.
- No modo `TOTAL`, o valor é dividido e eventual centavo residual vai para a
  última parcela.
- No modo `INSTALLMENT`, o valor digitado é o de cada parcela; o total é a
  multiplicação pela quantidade.
- Assinatura com `paymentMethod=CARD` entra no total mensal daquele cartão.
- Cada cartão pode ter `closingDay`, `bestPurchaseDay` e `paymentDay`. Se
  `bestPurchaseDay` ficar vazio, o melhor dia é calculado como 1 dia antes do
  fechamento; se preenchido, o valor manual prevalece para cartões com ciclos
  atípicos.
- A meta de cartões do mês compara o valor já previsto na próxima fatura
  (`month + 1`) com a meta cadastrada no mês aberto.
- Enquanto a próxima fatura projetada estiver abaixo da meta mensal, a diferença
  é calculada na tela do mês aberto, mas lançada como reserva de despesa
  prevista no mês da própria fatura. Portanto, a meta cadastrada no mês M gera
  reserva em M+1, e o planejamento de cartões de M+1 usa
  `fatura de M+1 + max(meta de M - fatura de M+1, 0)`.
- No dashboard, cada cartão ativo aparece no topo de Despesas como uma linha
  variável calculada. Essa linha é apenas uma representação da fatura já
  incluída nos totais, não um `ExpenseEntry` duplicado.
- `CardInvoicePayment` guarda o estado pago por cartão e mês. Ao marcar uma
  fatura como paga, seu total é descontado do saldo real e salvo em
  `paidAmount`; desmarcar reverte exatamente esse valor.
- A página `/cards` seleciona o mês por `searchParams.month`; totais, meta,
  reserva e estado pago devem sempre usar esse mês, não implicitamente o atual.
- A página `/cards/[cardId]` também seleciona uma fatura por
  `searchParams.month`; a tabela lista somente compras/parcelas que caem nesse
  mês, mantendo a data real da compra apenas como informação.
- Compras de cartão podem alterar a abertura de meses futuros; criação, edição e
  exclusão recalculam a cadeia a partir do mês afetado e do mês anterior, pois a
  reserva da meta depende da próxima fatura.
- Nos gastos por etiqueta do dashboard, a fatura de cartão é representada
  sempre pela etiqueta `Fatura do Cartão`; compras individuais de cartão não
  entram separadas nesse gráfico. Despesas e assinaturas sem etiqueta são
  ignoradas nesse gráfico.

### Visão mensal matricial

- `getBalanceChartRanges()` também fornece o detalhamento de cada mês por
  cartão, reserva da meta, entrada, despesa e assinatura.
- A matriz agrega linhas de mesmo tipo/nome, mantém 12 colunas para o período
  escolhido e calcula a coluna Total no cliente.
- Linhas finais mostram saldo inicial, saldo, total de entradas, total de
  saídas e diferença. Os gráficos permanecem como complemento visual.

### Assinaturas

- Uma assinatura vale desde `startMonth`.
- Cancelamento no mês X ainda cobra X; deixa de contar depois de X.
- Reativar remove `cancelledMonth`.
- Assinaturas possuem etiquetas via `SubscriptionTag`; assinaturas fora de
  cartão entram nos gastos por etiqueta do mês em que estão ativas usando seu
  `paymentMethod`. Assinaturas pagas por cartão entram no total da fatura e,
  no gráfico do dashboard, são representadas pela etiqueta `Fatura do Cartão`.

### Informações bancárias

- Contas bancárias e chaves Pix podem ser criadas, editadas e excluídas na tela
  Informações.
- Chaves Pix podem ser próprias (`OWN`) ou de pagamentos frequentes
  (`PAYEE`) e podem se vincular a uma conta do mesmo usuário.
- Ações de edição devem verificar propriedade por `userId`, inclusive para a
  conta vinculada informada no payload.

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
