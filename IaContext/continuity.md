# Continuidade

Atualizado em: 2026-07-05

## Estado atual

Foram ajustados o dashboard e a exclusão de despesas:

- excluir uma despesa recorrente agora remove seu template e todas as
  ocorrências, em vez de permitir que ela seja recriada automaticamente;
- os ajustes de saldo real são desfeitos e a cadeia mensal é recalculada;
- cartões ativos aparecem como linhas variáveis calculadas no topo de Despesas;
- o bloco separado de cartões foi removido do dashboard;
- os gráficos oferecem as visões “Ano completo” e “Próximos 12 meses”, ambas
  com 12 meses completos relativos ao mês aberto.

## Validação desta passagem

- `npm run lint`: passou em 2026-07-05.
- `npm run build`: passou após os ajustes em 2026-07-05 com Next.js 16.2.9.
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
