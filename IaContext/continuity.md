# Continuidade

Atualizado em: 2026-07-09

## Estado atual

### Objetivo

Integrar o Pluggy (open finance) para importar automaticamente lançamentos
bancários, compras de cartão e saldo real, reduzindo o lançamento manual.

### Alterações realizadas

- Novos modelos `PluggyConnection`, `PluggyAccountLink` e
  `PluggyImportedTransaction` (migration
  `20260709120000_pluggy_integration`), com relações inversas em `User`,
  `Account` e `Card`.
- `src/lib/services/pluggyClient.ts`: cliente HTTP com cache da `apiKey` e
  retry único em 401/403; `src/lib/services/pluggySync.ts`: motor de
  importação, dedup, recálculo da cadeia de saldos e aplicação do saldo real.
- Server Actions em `src/lib/actions/pluggy.ts` (connect token, finalizar
  conexão, vincular/desvincular, sincronizar, remover) e schemas Zod em
  `src/lib/validation/pluggySchemas.ts`.
- Nova página `/conexoes` (entrou no `NAV_LINKS`) com widget oficial
  `react-pluggy-connect`, sugestão de vínculo e ações por conexão.
- Rota pública `POST /api/webhooks/pluggy` autenticada por header secreto.
- `setActualBalance` foi dividido para expor `setActualBalanceForUser`,
  reutilizável pelo sync (que não tem sessão HTTP).
- Selo “Importado” nas tabelas de despesas, entradas e compras de cartão.

### Decisões e motivos

- Importação automática completa (escolha explícita do usuário), com histórico
  na primeira conexão e saldo real sobrescrevendo `actualBalance` a cada
  sincronização.
- Lançamentos importados são criados direto no Prisma para não somar delta de
  saldo em cima do saldo real vindo do banco (evita dupla contagem).
- `billingMonth` de compras importadas vem de `invoiceMonthForPurchase()`, não
  do `billId` do Pluggy, para manter uma única regra de fatura no sistema.
- Dedup pela unicidade de `pluggyTransactionId`, com a linha funcionando como
  lápide — excluir um lançamento importado não o traz de volta.

### Validações executadas

- `npx tsc --noEmit`, `npm run lint`, `npm run build`: passaram em 2026-07-09.
- `scripts/test-pluggy-sync-domain.ts` (novo, com o `pluggyClient` mockado por
  interceptação de módulo, sem tocar a API real): 20 asserções passaram —
  débito vira despesa paga com método inferido, crédito vira entrada recebida,
  compra de cartão em 07/07 cai na fatura de agosto com sufixo de parcela,
  `PENDING` é ignorada e importada quando liquida, saldo do mês igual ao saldo
  do banco, resync não duplica e lançamento excluído não ressuscita.
- Smoke test autenticado: `/dashboard`, `/cards`, `/assinaturas`, `/conexoes` e
  `/informacoes` retornaram 200; `/conexoes` mostra corretamente o estado “não
  configurada” sem credenciais.
- Webhook validado nos quatro caminhos: segredo correto com item desconhecido
  → 200 `ignored`, evento irrelevante → 200 `ignored`, payload incompleto →
  400, segredo errado ou ausente → 401.

### Pendências ou próximo passo

- **Não testado contra a API real do Pluggy** — falta o usuário criar uma
  aplicação no dashboard de desenvolvedor do Pluggy e informar
  `PLUGGY_CLIENT_ID`/`PLUGGY_CLIENT_SECRET`, além do domínio público para
  `APP_PUBLIC_URL` (o repositório não registra nenhum domínio).
- Após configurar o `.env` de produção: registrar o webhook no Pluggy
  (`registerWebhook()` existe no cliente, mas ainda não há comando/tela que o
  chame — registrar manualmente ou criar um script).
- Validar em sandbox antes de conectar uma conta bancária real.
- Após a primeira importação com histórico, revisar os lançamentos marcados
  como “Importado” e remover duplicatas do que já havia sido lançado à mão.

## Passagem anterior (2026-07-08)

### Objetivo

Corrigir o mês de fatura das compras de cartão (compras de 07/07 no Nubank
caíam em setembro em vez de agosto), transformar assinaturas em cobranças
mensais datadas com histórico, e melhorar o visual (cartõezinhos de banco,
número/CVV com copiar, bandeira, logos de assinaturas, ícone Pix, nova logo
Fortuna em moeda romana).

### Alterações realizadas

- `invoiceMonthForPurchase()` passou a considerar `paymentDay`: fatura paga no
  mesmo mês do fechamento quando `paymentDay > closingDay` (Nubank fecha dia 2
  e vence dia 10 → compra 07/07 cai em agosto); mês seguinte quando
  `paymentDay <= closingDay` ou nulo (comportamento anterior preservado).
  Nova inversa `chargeDateForBillingMonth()` para recorrências.
- Novo `scripts/recalculate-card-billing.ts` (idempotente) reaplica a regra a
  todas as compras existentes e recalcula a cadeia de saldos.
- Assinaturas: novos campos `chargeDay`, `cancelledAt` (data exata, migrado de
  `cancelledMonth` = último dia do mês; coluna antiga removida) e
  `logoDomain`. Novo modelo `SubscriptionCharge` materializa cada cobrança
  mensal (valor congelado); meses futuros são projetados virtualmente.
  Geração preguiçosa em `src/lib/services/subscriptionCharges.ts`, chamada nas
  páginas Dashboard, Cartões, detalhe do cartão e Assinaturas.
- Cancelar mantém cobranças até `cancelledAt`; reativar limpa o cancelamento e
  move `startMonth` para frente (sem cobrar o período cancelado). Editar
  dia/cartão/valor rematerializa do mês corrente em diante; editar o ciclo do
  cartão rematerializa compras e assinaturas daquele cartão.
- `subscriptionSummary.ts` reescrito (materializado + projeção); consumidores
  atualizados: `cardSummary`, `monthly`, `chart` (fluxo de caixa usa o dia da
  cobrança), `spendingByTag`.
- Cartões ganharam `cardNumber`, `cvv`, `expiryMonth`, `expiryYear`;
  `src/lib/cardBrand.ts` detecta a bandeira pelo número (Elo antes de
  Visa/Master) e o tema visual pelo nome do emissor. `BankCardVisual` renderiza
  o cartãozinho: lista compacta em /cards e versão completa no detalhe com
  máscara (últimos 4 visíveis), olho para revelar, cópia por bloco de 4
  dígitos, cópia do número completo e CVV oculto/copiável.
- Cobranças de assinatura aparecem como linhas somente leitura na fatura do
  cartão (logo + badge Assinatura/Cancelada, link Gerenciar).
- Logos de assinaturas via favicon do `logoDomain` (Google s2), com sugestão
  automática por nome (`subscription-logo.tsx`) e campo no diálogo; ícone Pix
  (`pix-icon.tsx`) na lista de chaves, formas de pagamento de despesas e
  assinaturas; nova logo Fortuna como moeda romana (dourada, borda perlada,
  louros e F serifado) mantendo o halo verde/violeta.
- Migration `20260708120000_card_details_subscription_charges` aplicada
  localmente.

### Decisões e motivos

- Cobranças passadas são materializadas (histórico imutável a cancelamentos e
  edições de preço) e futuras são projetadas (planejamento/reserva/gráficos
  continuam funcionando) — híbrido escolhido para satisfazer "cancelar não
  apaga o que já foi cobrado" sem quebrar projeções de 12 meses.
- `chargeDay` de assinaturas existentes ficou com default 1; o usuário deve
  ajustar o dia real de cada assinatura (a edição rematerializa o mês
  corrente em diante).
- Número/CVV ficam em texto no banco (app pessoal, single-user, atrás de
  autenticação); a UI sempre mascara por padrão.

### Validações executadas

- `npx tsc --noEmit`, `npm run lint` e `npm run build`: passaram em
  2026-07-08 (Next.js 16.2.9).
- `scripts/test-card-billing-domain.ts` (novo, roda com `npx tsx` e dados
  temporários): regra de fatura pura (Nubank 07/07→ago, 01/07→jul; fecha
  23/vence 1: 20/07→ago, 24/07→set; sem vencimento preserva regra antiga),
  inversa consistente para vários ciclos/dias, rematerialização corrige compra
  set→ago, assinatura dia 8 no cartão Nubank cobra 08/07 na fatura de agosto,
  cancelamento preserva cobrança feita e corta futuras, edição de dia refaz o
  mês corrente, assinatura fora de cartão conta no mês civil. Tudo passou em
  2026-07-08.
- Smoke test com `npm run start` + login de sessão real: /dashboard, /cards,
  /assinaturas e /informacoes responderam 200 autenticados; /login 200 e
  /dashboard 307 sem sessão.

### Pendências ou próximo passo

- Produção (após deploy, com pedido explícito do usuário): rodar
  `npx tsx scripts/recalculate-card-billing.ts` uma vez para realinhar as
  faturas existentes (a migration roda sozinha no deploy).
- Usuário deve revisar cada assinatura e definir o `chargeDay` real (default
  ficou 1) e, se quiser, o site da logo.
- Cadastrar número/CVV/validade dos cartões pela edição do cartão para ativar
  bandeira e cópia por blocos.

## Débitos documentais confirmados

- Substituir o `README.md` genérico por instruções reais do Finances.
- Revisar `deploy.md`: ele ainda cita ClassLog e contém exemplos que não
  descrevem exatamente o deploy atual.

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
