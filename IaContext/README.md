# Contexto compartilhado do Finances

Esta pasta é a fonte de contexto operacional para humanos e IAs que trabalham
no projeto. Ela complementa o código; se houver divergência, o código e o schema
do banco são a fonte de verdade e estes documentos devem ser corrigidos.

## Ordem de leitura

1. [info.md](info.md) — propósito, funcionalidades e estado atual.
2. [architecture.md](architecture.md) — arquitetura, modelo de dados e regras
   críticas do domínio.
3. [workflow.md](workflow.md) — como desenvolver, validar e entregar mudanças.
4. [continuity.md](continuity.md) — trabalho em andamento, decisões recentes e
   próximos passos.

Leia também:

- `AGENTS.md`, antes de qualquer alteração;
- o guia relevante em `node_modules/next/dist/docs/`, antes de escrever código
  Next.js;
- `prisma/schema.prisma`, antes de alterar persistência ou regras financeiras;
- `.env.example`, como referência das variáveis;
- `github-actions-deploy.md` (raiz), guia reutilizável de deploy automático
  com GitHub Actions e runner self-hosted — escrito para servir de base em
  outros projetos;
- `deploy.md` está **obsoleto** (descreve o ClassLog) e foi mantido só como
  histórico.

## Contrato de manutenção

- Não registre segredos, senhas, tokens nem valores financeiros reais aqui.
- Registre fatos confirmados; marque hipóteses como hipóteses.
- Alterações de regra de negócio devem atualizar `architecture.md`.
- Alterações de comandos, dependências ou deploy devem atualizar `workflow.md`.
- Ao encerrar uma sessão relevante, deixe em `continuity.md` apenas o estado
  útil para a próxima pessoa/IA. Remova itens resolvidos ou mova decisões
  duradouras para o documento apropriado.
- Datas usam `AAAA-MM-DD`; meses financeiros usam `AAAA-MM`.

## Mapa rápido

| Arquivo | Responsabilidade |
| --- | --- |
| `info.md` | Visão do produto e inventário funcional |
| `architecture.md` | Estrutura técnica e invariantes |
| `workflow.md` | Setup, comandos, validações e entrega |
| `continuity.md` | Estado corrente e passagem de bastão |
| `../github-actions-deploy.md` | Como replicar a esteira de deploy em outro projeto |
