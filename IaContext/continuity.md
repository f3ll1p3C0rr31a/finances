# Continuidade

Atualizado em: 2026-07-05

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
- Produção: endpoint de versão, login, banco pós-exclusão e logs validados em
  2026-07-05.
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
