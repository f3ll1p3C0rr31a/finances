# Continuidade

Atualizado em: 2026-09-08

## Estado atual

### Objetivo

Permitir parcelar uma despesa avulsa (dívida paga em N boletos mensais,
informando o valor total ou o valor da parcela, como já era feito nas compras
de cartão) e completar as referências de boleto com número da linha digitável
além do link e do PDF.

### Alterações realizadas

- Novo modelo `ExpenseInstallmentPlan` e colunas `installmentPlanId`,
  `installmentNo` e `boletoNumber` em `ExpenseEntry`. Migration
  `20260908120000_expense_installments_and_boleto`.
- `createExpenseEntry()` materializa todas as parcelas na criação, uma
  `ExpenseEntry` por mês a partir do mês aberto, como `CardPurchase` faz com
  `CardInstallment`. Parcelar é excludente com recorrência e com pendência
  incerta.
- `updateExpenseEntry()` propaga nome e categoria para o plano inteiro e
  recalcula `plan.totalAmount` quando o valor de uma parcela muda.
- `deleteExpenseForUser()` trata plano como trata recorrência: apagar uma
  parcela apaga o acordo inteiro. A compensação de pagamentos virou
  `compensatePaidEntries()`, usada pelos dois caminhos, respeitando
  `movesOwnMoney()`.
- `setExpenseEntryTags()` aplica as etiquetas a todas as parcelas do plano,
  além da propagação para recorrentes que já existia.
- `resolvePurchaseAmounts()` (em `services/cardPurchase.ts`) passou a delegar
  para `resolveInstallmentAmounts()` em `calculations/installments.ts`, para
  que a regra total-vs-parcela seja uma só entre cartão e despesa.
- Diálogo da despesa: bloco "Parcelar o pagamento" (quantidade, valor total ou
  da parcela, prévia "4x de R$ 875,00 — Total R$ 3.500,00" e intervalo de
  meses) e bloco de boleto (número + PDF) que aparece quando a forma de
  pagamento é Boleto. Editando uma parcela, mostra "Parcela 2/4 de R$ ...".
- Diálogo "Refs." ganhou o número do boleto com botão de copiar, exibido em
  blocos por `formatBoletoNumber()` (47 dígitos bancário, 48 de convênio).
- Tabela de despesas mostra a badge `Parcela n/N`; o toast de exclusão diz
  quantas parcelas saíram.

### Decisões e motivos

- Parcelas materializadas na criação, em vez de template com `endMonth`:
  dashboard, matriz, gráficos, fluxo de caixa e gastos por etiqueta já leem
  `ExpenseEntry` por mês, então tudo passa a funcionar sem geração preguiçosa,
  e a regra "ONE_OFF não gera template" continua valendo.
- Apagar uma parcela apaga o plano inteiro, espelhando a recorrência: um
  parcelamento é uma dívida só.
- Nome, categoria e etiquetas são do plano; valor, link, número de boleto e
  anexo são da parcela, porque cada boleto tem número e PDF próprios. Por isso
  o número digitado ao criar um plano fica só na 1ª parcela.
- Número do boleto é normalizado para dígitos puros quando a entrada só tem
  dígitos, pontos e espaços (para colar no app do banco) e reexibido em blocos;
  qualquer outro texto é guardado como digitado.

### Validações executadas

- `npx prisma generate`, `npx tsc --noEmit`, `npm run lint` e `npm run build`:
  passaram em 2026-09-08 (Next.js 16.2.9).
- Migration conferida contra o DDL que o Prisma geraria para o mesmo schema
  (`prisma migrate diff --from-empty --to-schema`): idêntica.
- Não foi testada contra banco nem no navegador: a máquina onde a mudança foi
  escrita não tinha Node, Docker nem PostgreSQL (o Node foi baixado à parte só
  para rodar as validações acima).

### Pendências ou próximo passo

- Testar no navegador depois do deploy: lançar uma despesa parcelada em 4x pelo
  valor total, conferir as 4 parcelas nos meses seguintes, os totais, a matriz
  e a cadeia de saldos; editar e apagar uma parcela; anexar PDF e número de
  boleto.

## Débitos documentais confirmados

- Substituir o `README.md` genérico por instruções reais do Finances.
- `deploy.md` foi marcado como obsoleto e substituído por
  `github-actions-deploy.md` na raiz. Resta decidir se o antigo pode ser
  apagado de vez.

## Pontos de atenção para próximas mudanças

- Regras de saldo mensal têm efeitos em cadeia; não alterar isoladamente.
- Server Actions precisam verificar propriedade por `userId`.
- O projeto usa Next.js 16.2.9; ler a documentação instalada antes de codificar.
- Não habilitar `cacheComponents` incidentalmente.
- Cobranças de assinatura materializadas nunca são sobrescritas pela geração;
  correções de dados passados exigem apagar/refazer o `SubscriptionCharge`.

## Modelo para a próxima passagem

Substitua a seção "Estado atual" ao iniciar trabalho relevante:

```md
### Objetivo

### Alterações realizadas

### Decisões e motivos

### Validações executadas

### Pendências ou próximo passo
```
