# Continuidade

Atualizado em: 2026-07-07

## Estado atual

Foram ajustados o dashboard e a exclusão de despesas:

- excluir uma despesa recorrente agora remove seu template e todas as
  ocorrências, em vez de permitir que ela seja recriada automaticamente;
- os ajustes de saldo real são desfeitos e a cadeia mensal é recalculada;
- a remoção foi extraída para um serviço testável e validada por integração
  contra PostgreSQL com dados temporários;
- cartões ativos aparecem como linhas variáveis calculadas no topo de Despesas;
- a coluna Pago dessas linhas agora possui um switch persistente por cartão e
  mês; marcar/desmarcar ajusta e reverte o saldo real pelo valor da fatura;
- a diferença positiva entre a meta combinada e as faturas é exibida como
  despesa prevista e incluída no saldo planejado e nos gráficos;
- o vencimento de despesas passou de campo numérico para calendário; no modo
  dia útil, datas não úteis ficam indisponíveis;
- entradas e despesas podem ser marcadas como incertas: ficam fora dos totais,
  avançam para o mês atual enquanto pendentes e entram no mês quando
  recebidas/pagas;
- o resumo mensal ganhou uma prévia separada que considera valores incertos sem
  tratá-la como saldo oficial;
- `actualBalance` agora aparece como “Saldo Atual” imediatamente abaixo do
  planejado, sincroniza visualmente após Pago/Recebido e parte do saldo inicial
  quando ainda não tiver sido gravado;
- a visão financeira ganhou uma matriz semelhante à planilha original, com
  lançamentos por linha, meses por coluna, total lateral e resumos no rodapé;
- a guia Cartões ganhou navegação Anterior/Próximo via `?month=AAAA-MM`, e
  todos os cálculos da página respeitam o mês escolhido;
- a tela de detalhe de um cartão também ganhou navegação mensal via
  `?month=AAAA-MM`, lista apenas a fatura do mês escolhido e mantém gráficos de
  histórico e próximos 12 meses;
- o resumo mensal mostra Saldo Inicial, Total de Entrada, Entradas Futuras,
  Total de Saídas, Saídas Futuras, Diferença, Saldo Planejado e Saldo Atual;
- entradas futuras representam valores ainda não recebidos; saídas futuras
  representam despesas em aberto, cartões não pagos, reserva da meta e
  assinaturas fora do cartão;
- a reserva da meta de cartões é calculada no mês aberto, mas lançada apenas no
  mês da fatura projetada (`month + 1`), não no mês vigente;
- `PaymentMethod` ganhou `BOLETO`, disponível em despesas, assinaturas e filtros
  de gastos por etiqueta;
- cartões ganharam `bestPurchaseDay` opcional; quando vazio, o melhor dia é 1
  dia antes do fechamento; quando preenchido, o valor manual prevalece;
- cartões ganharam `paymentDay`, exibido como vencimento da fatura;
- compras de cartão ganharam `billingMonth`; compras feitas após o
  `closingDay` passam a iniciar cobrança na fatura do mês seguinte, inclusive
  a primeira parcela de compras parceladas;
- editar o fechamento de um cartão recalcula o mês de cobrança das compras já
  registradas daquele cartão e rematerializa as parcelas;
- assinaturas ganharam etiquetas por `SubscriptionTag`; a página Assinaturas
  permite criar/editar etiquetas e elas entram nos gastos por etiqueta;
- a meta dos cartões do mês agora compara a meta com a próxima fatura projetada
  (`month + 1`), e a despesa planejada de cartões usa a fatura do mês somada à
  reserva restante dessa próxima fatura;
- criação, edição e exclusão de compras de cartão recalculam a cadeia de saldos
  do mês afetado e do anterior;
- o app foi renomeado visualmente para Fortuna, com logo SVG próprio e paleta
  mais viva em verde/roxo;
- o bloco separado de cartões foi removido do dashboard;
- os gráficos oferecem as visões “Ano completo” e “Próximos 12 meses”, ambas
  com 12 meses completos relativos ao mês aberto.
- o deploy expõe `/api/version` e só passa no health check quando o SHA servido
  corresponde ao commit disparado pelo GitHub Actions.
- Em produção, a duplicidade “Nubank” foi removida pelo serviço de domínio em
  2026-07-05: um template e 12 ocorrências foram apagados; o cartão foi
  preservado. Foi criado backup SQL imediatamente antes da operação.

## Validação desta passagem

- `npm run lint`: passou em 2026-07-05.
- `npm run build`: passou após os ajustes em 2026-07-05 com Next.js 16.2.9.
- Teste de integração isolado da exclusão recorrente: passou em 2026-07-05.
- Teste de integração do pagamento e estorno de fatura: passou em 2026-07-05.
- Teste de integração da reserva da meta (R$ 4.500 gastos / R$ 5.000 de meta):
  passou com reserva de R$ 500 e despesa planejada de R$ 5.000.
- Teste de integração de pendências incertas: confirmou avanço de mês, exclusão
  dos totais enquanto pendentes, inclusão na prévia e contabilização após
  liquidação.
- Teste do Saldo Atual: confirmou inicialização em R$ 100, movimento de +R$ 50
  para R$ 150 e reversão para R$ 100.
- Teste da matriz: confirmou 12 meses em ambas as visões e detalhamento correto
  de cartão e receita.
- `npm run lint`: passou em 2026-07-06.
- `npm run build`: passou em 2026-07-06 com Next.js 16.2.9.
- Teste local de domínio: confirmou entrada futura R$ 1.000, saída futura
  R$ 300, fechamento dia 10 gerando melhor compra dia 9 e override manual sendo
  respeitado.
- Teste local de domínio em 2026-07-07: com fechamento dia 5 e vencimento dia
  10, uma compra em 02/07 ficou na fatura de julho; compra parcelada em 08/07
  iniciou em agosto; totais retornaram R$ 12 em julho e R$ 100 em agosto.
- Teste local de domínio em 2026-07-07: uma meta de julho para fatura de agosto
  calculou reserva, não lançou a reserva em julho, lançou em agosto e fechou o
  planejado de agosto na meta; assinatura com tag `Stream` apareceu em gastos
  por etiqueta como método `CARD`.
- Produção: endpoint de versão, login, banco pós-exclusão e logs validados em
  2026-07-05.
- Produção: deploy do commit `e3175f4` validado em 2026-07-06; `/api/version`
  retornou o SHA esperado, `/login` retornou 200 com a marca Fortuna e
  `/dashboard` retornou 307 sem sessão autenticada, como esperado.
- Testes automatizados: não existem no projeto.

## Débitos documentais confirmados

- Substituir o `README.md` genérico por instruções reais do Finances.
- Revisar `deploy.md`: ele ainda cita ClassLog e contém exemplos que não
  descrevem exatamente o deploy atual.

## Pontos de atenção para próximas mudanças

- Regras de saldo mensal têm efeitos em cadeia; não alterar isoladamente.
- Server Actions precisam verificar propriedade por `userId`.
- O projeto usa Next.js 16.2.9; ler a documentação instalada antes de codificar.
- Não habilitar `cacheComponents` incidentalmente.

## Modelo para a próxima passagem

Substitua esta seção ao iniciar trabalho relevante:

```md
### Objetivo

### Alterações realizadas

### Decisões e motivos

### Validações executadas

### Pendências ou próximo passo
```
