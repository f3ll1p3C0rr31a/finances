# Informações do projeto

## O que é

`Fortuna` é uma aplicação web pessoal de planejamento financeiro mensal. Ela
centraliza entradas, despesas, saldos, cartões de crédito, compras parceladas,
metas, assinaturas, etiquetas, contas e chaves Pix.

O sistema é autenticado e todos os dados de negócio pertencem a um usuário.
O seed atual cria ou atualiza um usuário a partir de variáveis de ambiente.

## Stack confirmada

- Next.js 16.2.9 com App Router e Turbopack;
- React 19.2.4 e TypeScript estrito;
- PostgreSQL 16;
- Prisma 7.8 com driver adapter `@prisma/adapter-pg`;
- Auth.js / NextAuth 5 beta com credenciais e sessão JWT;
- Tailwind CSS 4, shadcn e Base UI;
- Zod 4 e React Hook Form;
- Recharts para gráficos;
- Docker Compose para desenvolvimento e produção.

As versões exatas estão em `package.json` e `package-lock.json`.

## Funcionalidades existentes

- Login por e-mail e senha.
- Dashboard mensal em `/dashboard/[month]`.
- Entradas e despesas avulsas ou recorrentes.
- Entradas e despesas incertas, carregadas para o mês atual até a liquidação.
- Vencimento por dia corrido ou por enésimo dia útil brasileiro.
- Marcação de recebido/pago com ajuste do saldo real.
- Saldo inicial, saldo planejado e saldo real com propagação entre meses.
- Saldo mensal com entradas/saídas combinadas e valores futuros em aberto.
- Prévia de saldo que inclui pendências incertas sem alterar o saldo oficial.
- Cartões, limite, fechamento, melhor dia de compra e compras parceladas.
- Meta mensal combinada para gastos de cartões.
- Assinaturas pagas por cartão ou fora do cartão.
- Etiquetas aplicáveis a entradas, despesas e compras.
- Gráficos de saldo, entradas/saídas, cartões e gastos por etiqueta.
- Matriz financeira anual/12 meses com lançamentos nas linhas e meses nas
  colunas, inspirada na planilha original.
- Cadastro informativo de contas e chaves Pix próprias/de favorecidos.
- Formas de pagamento: dinheiro, Pix, transferência, boleto, cartão e outro.
- Deploy automático da branch `main` em runner self-hosted.

## Rotas principais

| Rota | Função |
| --- | --- |
| `/` | Redireciona para login ou dashboard |
| `/login` | Autenticação |
| `/dashboard` | Redireciona para o mês atual |
| `/dashboard/[month]` | Visão financeira do mês `AAAA-MM` |
| `/cards?month=AAAA-MM` | Cartões e meta do mês selecionado |
| `/cards/[cardId]` | Compras, limite e histórico do cartão |
| `/assinaturas` | Assinaturas ativas e canceladas |
| `/informacoes` | Contas e chaves Pix |
| `/api/auth/[...nextauth]` | Endpoints do Auth.js |

`/cashflow` e `/cashflow/[month]` são rotas de compatibilidade que redirecionam
para o dashboard.

## Estado observado em 2026-07-05

- Branch e árvore de trabalho estavam limpas antes da criação de `IaContext/`.
- `npm run lint` passou.
- O resultado mais recente de `npm run build` deve ser mantido em
  `continuity.md`.
- Não há suíte de testes automatizados nem script `test` em `package.json`.
- `README.md` ainda é o template padrão do `create-next-app`.
- `deploy.md` mistura a infraestrutura real do Finances com instruções antigas
  do ClassLog; use `.github/workflows/deploy.yml`,
  `scripts/deploy-production.sh`, `docker-compose.production.yml` e `Dockerfile`
  como fontes primárias.

## Fontes de verdade

1. Regras persistidas: `prisma/schema.prisma` e migrations.
2. Comportamento financeiro: `src/lib/calculations/` e
   `src/lib/actions/monthly.ts`.
3. Mutação e autorização: `src/lib/actions/`.
4. UI e composição de dados: `src/app/` e `src/components/`.
5. Dependências e comandos: `package.json`.
6. Produção: workflow, script e arquivos Docker citados acima.
