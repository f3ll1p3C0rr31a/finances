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
- `Card` pode guardar `cardNumber`, `cvv`, `expiryMonth` e `expiryYear` para
  referência rápida do usuário. A bandeira não é persistida: é detectada pelo
  número (`src/lib/cardBrand.ts`), que também define o tema visual do
  cartãozinho pelo nome do emissor.
- `SubscriptionCharge` é uma cobrança mensal materializada de uma
  `Subscription` (única por `(subscriptionId, month)` civil). `chargeDate` é o
  dia em que o serviço cobrou; `billingMonth` é a fatura em que a cobrança cai
  (ciclo do cartão aplicado; igual ao mês civil fora de cartão).
- `CardSpendingGoal` é uma meta mensal somando todos os cartões.
- A meta efetiva de cartões de um mês é a última `CardSpendingGoal` cadastrada
  naquele mês ou antes dele. Ao salvar uma meta em M, metas futuras explícitas
  são removidas para que M passe a valer para M e todos os meses seguintes,
  sem alterar meses anteriores.
- `Subscription` é uma cobrança recorrente sem fim predefinido.
- `Tag` se relaciona N:N com entradas, despesas, compras e assinaturas.
- `Account` representa banco/conta com dados como banco, agência, número, tipo
  e titular. `PixKey` própria e `Card` podem se vincular a uma `Account`; uma
  chave Pix de terceiro guarda banco de destino em texto, sem vínculo com conta
  própria. Uma despesa pode referenciar uma chave Pix de favorecido.
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
  totais oficiais, das entradas/saídas futuras, do saldo planejado e dos
  gráficos.
- Na interface, valor incerto pendente é azul (positivo) ou roxo (negativo) e
  conta de terceiro é cinza apagado, para não se confundirem com o
  verde/vermelho do dinheiro confirmado (`MoneyTone` em
  `src/lib/calculations/format.ts`).
- A prévia de saldo é `saldo planejado + entradas incertas - despesas incertas`.
- Ao marcar como recebido/pago, o lançamento passa a integrar os totais do mês
  em que foi liquidado, deixa a prévia pendente e não avança mais.
- Pendência incerta e template recorrente são conceitos mutuamente exclusivos.

### Cadeia de saldo

- `openingBalance` vem do fechamento do mês anterior.
- O fechamento planejado do mês é
  `computePlannedBalance(actualBalance ?? openingBalance, entradas futuras, saídas futuras)`,
  ou seja **saldo atual + o que ainda falta acontecer**. Regra alterada em
  2026-08-18: antes era `abertura + entradas totais - saídas totais`, o que
  reconstruía o mês inteiro e repetia toda imprecisão já liquidada (valor pago
  diferente do previsto, correção manual do saldo real).
- Entradas futuras = entradas não recebidas e não incertas. Saídas futuras =
  despesas não pagas e não incertas + faturas de cartão não pagas + reserva da
  meta dos cartões + assinaturas fora de cartão. A composição vive em
  `getMonthOpenCashflow()` e precisa ser a mesma no painel do mês, na cadeia de
  saldos e nos gráficos.
- Consequências da regra: em mês futuro intocado ela devolve exatamente o mesmo
  valor da regra antiga; em mês totalmente liquidado devolve o próprio saldo
  atual.
- Despesas totais (linha "Total de Saídas") continuam somando lançamentos,
  cartões e assinaturas fora de cartão — elas descrevem o mês inteiro, não o
  que falta.
- O `openingBalance` do mês seguinte é o **fechamento planejado** do mês
  corrente, não o saldo atual cru. No meio do mês o saldo atual ainda não
  sofreu os descontos e recebimentos que vão acontecer até o dia 31; passá-lo
  adiante faria o mês seguinte abrir com dinheiro já comprometido.
- Consequência útil: marcar uma conta como paga derruba o saldo atual e tira o
  mesmo valor das saídas futuras, então o valor herdado **não se mexe** — ele
  já está estável muito antes do fim do mês, e no último dia converge para o
  saldo atual se nada ficou em aberto.
- Esta decisão já foi revertida duas vezes (a alternativa era herdar o saldo
  atual). Confirme com o usuário antes de invertê-la de novo.
- Alterações que afetam um mês materializado podem exigir
  `recalcOpeningBalanceChain()`.
- Marcar uma entrada recebida ou despesa paga ajusta o Saldo Atual.
- Na interface, `actualBalance` é apresentado como “Saldo Atual”. Recebimentos
  somam, pagamentos subtraem e desmarcar aplica o movimento inverso.
- Se o Saldo Atual ainda não existir, o primeiro movimento parte de
  `openingBalance`; ele nunca deve ser silenciosamente ignorado.
- Despesas podem ter um `externalLink` para portal/geração de boleto e um PDF
  anexado por ocorrência mensal. PDFs ficam fora de `public/`, em
  `storage/boletos`, e são baixados por rota autenticada que verifica o dono da
  despesa.

### Recorrentes e herança

- Um mês novo de lançamento recorrente nasce copiando o **mês anterior mais
  recente** daquele template (`expenseSeedForMonth()` / `incomeSeedForMonth()`),
  não os valores congelados no template. O template só entra quando não existe
  nenhum mês anterior; ele continua sendo atualizado nas edições para servir a
  esse caso.
- Editar um lançamento recorrente propaga as características para os meses
  seguintes **ainda abertos** (`propagateExpenseTraits()` /
  `propagateIncomeTraits()`): nome, valor, categoria, dia/tipo de vencimento,
  pago por, forma de pagamento, chave Pix e link externo. As etiquetas seguem o
  mesmo caminho (`propagateExpenseTags()` / `propagateIncomeTags()`), senão o
  gráfico por etiqueta perderia a conta a partir do mês seguinte.
- Nunca são reescritos: meses já encerrados (`month >= currentMonth()` é
  condição para herdar) e lançamentos já pagos/recebidos — o pagamento já mexeu
  no saldo real e alterar o valor por baixo deixaria a conta inconsistente.
- `dueDate` é recalculado mês a mês na propagação, porque dia útil cai em datas
  diferentes em cada mês.
- Faturas de cartão ficam fora dessa herança de propósito: mudam de valor todo
  mês e são calculadas a partir das compras.
- Editar ou criar um lançamento recalcula a cadeia de saldos a partir daquele
  mês: o valor entra no fechamento planejado, que é o saldo inicial do mês
  seguinte.

### Cartões

- Compra à vista conta no `billingMonth`, não necessariamente no mês civil de
  `purchaseDate`. `billingMonth` representa o mês em que a fatura é paga no
  dashboard, não o mês em que a fatura fecha.
- Compra parcelada cria todas as parcelas antecipadamente a partir do
  `billingMonth`.
- `billingMonth` é calculado por `invoiceMonthForPurchase()` usando o ciclo
  (`closingDay` + `paymentDay`) do cartão da própria compra. Sem `closingDay`,
  usa o mês da compra. Com fechamento: compra até o dia de fechamento pertence
  à fatura que fecha no próprio mês civil; depois do fechamento, à fatura que
  fecha no mês seguinte. O mês de pagamento é o mês do fechamento quando
  `paymentDay > closingDay` (ex.: Nubank fecha dia 2 e vence dia 10 — compra em
  07/07 fecha em 02/08 e é paga em 10/08, `billingMonth` agosto) e o mês
  seguinte ao fechamento quando `paymentDay <= closingDay` ou nulo (ex.: fecha
  dia 23 e vence dia 1 — compra em 20/07 paga em 01/08; em 24/07, em 01/09).
- `chargeDateForBillingMonth()` é a inversa dessa regra para recorrências:
  dado um dia de cobrança e uma fatura, devolve a data civil da cobrança.
- `scripts/recalculate-card-billing.ts` reaplica a regra a todas as compras
  existentes e recalcula a cadeia de saldos (rodar uma vez após mudar a regra
  de ciclo; idempotente).
- No modo `TOTAL`, o valor é dividido e eventual centavo residual vai para a
  última parcela.
- No modo `INSTALLMENT`, o valor digitado é o de cada parcela; o total é a
  multiplicação pela quantidade.
- Assinatura com `paymentMethod=CARD` entra no total mensal daquele cartão.
- Cada cartão pode ter `closingDay`, `bestPurchaseDay` e `paymentDay`. Se
  `bestPurchaseDay` ficar vazio, o melhor dia é calculado como 1 dia depois do
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
- `openInvoiceMonth(card)` devolve o mês de faturamento da fatura que ainda
  está aberta hoje — é `invoiceMonthForPurchase()` aplicado à data atual, logo
  antes do fechamento é a fatura deste ciclo e a partir do dia seguinte já é a
  próxima.
- A página `/cards` sem `searchParams.month` mostra, para cada cartão, a
  própria fatura em aberto (`getCardsOpenInvoiceSummary()`), porque cada cartão
  tem o seu ciclo. Com `month` na URL, todos os cartões passam a mostrar a
  fatura daquele mês. O painel de meta e a navegação continuam ancorados no mês
  civil selecionado.
- A página `/cards/[cardId]` sem `month` abre na fatura em aberto do cartão;
  com `month`, na fatura daquele mês. A tabela lista somente compras/parcelas
  que caem no mês selecionado, mantendo a data real da compra apenas como
  informação.
- No dashboard, o resumo de cartões continua sendo a fatura que **vence** no
  mês exibido, porque ali o número representa saída de caixa do mês.
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
- O gráfico de saldo ao longo do tempo também mostra saídas e diferença.
- O dashboard possui um gráfico diário de fluxo de caixa do mês: entradas e
  saídas acumuladas por dia, com faturas de cartão alocadas no `paymentDay` do
  cartão, lançamentos manuais na sua data de vencimento e assinaturas fora de
  cartão no seu dia de cobrança.

### Assinaturas

- Uma assinatura cobra todo mês no `chargeDay`, a partir de `startMonth`
  (primeira cobrança = `chargeDay` de `startMonth`).
- Quando a data de cobrança é atingida, a cobrança vira um
  `SubscriptionCharge` materializado (geração preguiçosa e idempotente por
  `ensureSubscriptionChargesGenerated()`, chamada nas páginas Dashboard,
  Cartões, detalhe do cartão e Assinaturas). O valor é congelado no momento da
  cobrança; edições de preço/cotação só afetam cobranças seguintes.
- Meses futuros usam projeção virtual: enquanto a assinatura estiver ativa, a
  cobrança projetada aparece na fatura correspondente (para gráficos, meta e
  reserva). Materializado sempre vence projeção no mesmo mês civil.
- Em cartão, a cobrança entra na fatura definida pelo ciclo do cartão a partir
  da `chargeDate` (mesma regra de compras). Fora de cartão, conta no próprio
  mês civil e no fluxo de caixa no dia `chargeDay`.
- Cancelar grava `cancelledAt` (data exata): cobranças com data até
  `cancelledAt` permanecem; posteriores deixam de existir. A assinatura
  cancelada continua listada (seção Canceladas) e pode ser reativada.
- Reativar limpa `cancelledAt` e move `startMonth` para frente (mês atual, ou
  próximo mês se o `chargeDay` já passou), para nunca cobrar o período em que
  esteve cancelada; o histórico materializado é preservado.
- Editar dia/cartão/valor rematerializa apenas do mês civil corrente em
  diante (`rematerializeUpcomingSubscriptionCharges()`); editar o ciclo do
  cartão faz o mesmo para as assinaturas daquele cartão.
- Assinaturas possuem etiquetas via `SubscriptionTag`; cobranças fora de
  cartão entram nos gastos por etiqueta do mês da cobrança usando seu
  `paymentMethod`. Assinaturas pagas por cartão entram no total da fatura e,
  no gráfico do dashboard, são representadas pela etiqueta `Fatura do Cartão`.
- Na tela do cartão, as cobranças da fatura aparecem como linhas somente
  leitura (badge Assinatura) junto às compras.
- Assinaturas podem ser cadastradas em BRL ou USD. Para USD, `originalAmount`
  guarda o valor em dólar, `exchangeRate` guarda a cotação usada e `amount`
  guarda o valor final em reais que entra nos saldos/cartões.
- `logoDomain` guarda o site do serviço para exibir a logo (favicon);
  serviços conhecidos são sugeridos pelo nome em
  `src/components/brand/subscription-logo.tsx`.

### Informações bancárias

- Contas bancárias e chaves Pix podem ser criadas, editadas e excluídas na tela
  Informações.
- Chaves Pix podem ser próprias (`OWN`) ou de pagamentos frequentes
  (`PAYEE`) e possuem tipo (`PHONE`, `CPF`, `CNPJ`, `EMAIL`, `RANDOM`).
- Chaves Pix próprias podem se vincular a uma conta do mesmo usuário.
- Chaves Pix de terceiros não devem se vincular a contas próprias; elas usam
  `destinationBankName` e `destinationBankCode` para registrar o banco de
  destino.
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
