# Continuidade

Atualizado em: 2026-09-22

## Estado atual

### Objetivo

Corrigir o botão Excluir de lançamento recorrente, que parecia não funcionar, e
passar a perguntar se a exclusão vale só para o mês aberto ou dali em diante.

### Alterações realizadas

- Causa do bug: `deleteIncomeEntry()` apagava só a `IncomeEntry` e deixava o
  `IncomeTemplate` ativo com `endMonth` nulo. No render seguinte,
  `ensureTemplateEntries()` recriava a linha copiando o mês anterior, então a
  exclusão parecia não ter efeito. Despesa recorrente não tinha esse bug, mas
  ia ao outro extremo: apagava o template e **todas** as ocorrências, inclusive
  meses passados já fechados.
- Novo `RecurrenceScope` (`ONLY_THIS` | `THIS_AND_FUTURE`), validado por Zod na
  server action e repassado aos serviços.
- Novos modelos `IncomeTemplateSkip` e `ExpenseTemplateSkip` (migration
  `20260922120000_recurring_delete_scope`) registram o mês excluído
  pontualmente; `ensureTemplateEntries()` pula esses meses. Sem isso,
  `ONLY_THIS` sofreria do mesmo bug.
- Novo `src/lib/services/deleteIncome.ts`, espelhando `deleteExpense.ts`:
  compensa no saldo real os recebimentos apagados e recalcula a cadeia de
  aberturas a partir do mês mais antigo afetado.
- `deleteExpenseForUser()` ganhou o mesmo escopo. `THIS_AND_FUTURE` agora
  encerra o template em `endMonth = mês - 1` em vez de apagar o histórico.
- Novo `DeleteEntryButton` compartilhado pelas duas tabelas: lançamento avulso
  exclui direto; recorrente abre um diálogo com as duas opções, nomeando o mês
  aberto.

### Decisões e motivos

- `endMonth` já existia nos dois templates e é exatamente a semântica de
  "encerrar daqui em diante", então `THIS_AND_FUTURE` não precisou de coluna
  nova — só o caso `ONLY_THIS` exigiu a tabela de exceções.
- Duas tabelas de exceção em vez de uma polimórfica: mantém a chave estrangeira
  com cascade e segue o padrão do projeto, que já duplica as estruturas de
  entrada e despesa lado a lado.
- Excluir a partir do `startMonth` apaga o template inteiro: um `endMonth`
  anterior ao `startMonth` deixaria uma recorrência que não gera nada.

### Validações executadas

- `npx tsc --noEmit`, `npm run lint` e `npm run build`: passaram em 2026-09-22.
- Novo `scripts/test-recurring-delete-domain.ts` contra banco real: os dois
  escopos em entrada e despesa, exclusão desde o primeiro mês, compensação do
  saldo real e — o caso do bug — remontar o ano inteiro depois de excluir, sem
  o lançamento ressuscitar. Todos passaram.
- `scripts/test-balance-domain.ts`: passou.

### Pendências ou próximo passo

- `scripts/test-card-billing-domain.ts` falha em "cobrança de setembro é
  projetada". É anterior a esta mudança (confirmado rodando no `main` limpo) e
  não tem relação com ela: o teste fixa setembro/2026 como mês futuro e
  envelheceu quando a data real passou do dia de cobrança. Vale reescrever o
  caso em função do mês corrente em vez de uma data fixa.

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
