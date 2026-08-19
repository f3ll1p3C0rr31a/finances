# Fluxo de trabalho

## Antes de editar

1. Leia `AGENTS.md`, este diretório e os arquivos diretamente envolvidos.
2. Rode `git status --short` e preserve alterações existentes do usuário.
3. Para código Next.js, leia o guia aplicável em
   `node_modules/next/dist/docs/`.
4. Para banco ou cálculo financeiro, trace o impacto no schema, migrations,
   materialização mensal e cadeia de saldos.

## Ambiente local

Pré-requisitos: Node.js compatível com o lockfile, npm e Docker com Compose.

```bash
cp .env.example .env
docker compose up -d
npx prisma generate
npx prisma migrate deploy
npx tsx prisma/seed.ts
npm run dev
```

O app abre em `http://localhost:3000`. O PostgreSQL local expõe a porta `5432`.
Defina em `.env` `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL`,
`SEED_USER_EMAIL` e `SEED_USER_PASSWORD`. Nunca versione `.env`.

Para criar uma migration durante desenvolvimento, prefira:

```bash
npx prisma migrate dev --name descricao_curta
```

Não edite migrations já aplicadas. Após mudar o schema, gere novamente o client.

## Comandos disponíveis

```bash
npm run dev
npm run lint
npm run build
npm run start
```

Ainda não existe runner de testes. Há scripts de domínio executáveis com
`npx tsx`:

```bash
npx tsx scripts/test-balance-domain.ts        # saldo planejado, saldo herdado e fatura em aberto (puro, sem banco)
npx tsx scripts/test-card-billing-domain.ts   # ciclo de fatura (precisa de banco)
```

Para mudanças de cálculos, estenda esses scripts antes de ampliar regras de
alto risco.

Scripts de manutenção (idempotentes, rodam contra o banco apontado por
`DATABASE_URL`):

```bash
npx tsx scripts/recalculate-balance-chain.ts     # reaplica a regra de saldo herdado
npx tsx scripts/recalculate-card-billing.ts      # realinha o mês de fatura das compras
node scripts/generate-icons.mjs                  # regera os ícones (web e Android) a partir da moeda
```

## Checklist de implementação

- Validação Zod cobre a entrada e mensagens ao usuário.
- Server Action autentica e autoriza o recurso.
- Valores monetários permanecem `Decimal` no servidor.
- Datas mensais permanecem normalizadas em UTC.
- Escritas relacionadas são atômicas quando necessário.
- Rotas afetadas são revalidadas.
- Props de Server para Client Components são serializáveis.
- Estados vazio, carregando, erro e interação móvel foram considerados.
- Schema e migration permanecem sincronizados.
- `IaContext` foi atualizado se a mudança alterou arquitetura ou operação.

## Validação mínima antes de entregar

```bash
npm run lint
npm run build
git diff --check
git status --short
```

Além disso, teste manualmente o fluxo alterado no navegador quando houver
mudança de UI ou regra financeira. Um build verde não valida o significado dos
cálculos.

## Produção

Servidor atual: **Saturno** (Proxmox em 192.168.0.11), CT 101 `ct-web`. A
migração veio do Jupiter (192.168.0.10) em agosto/2026.

- Checkout: `/dados/sites/finances/app` (o `.env` de produção vive aí e é
  preservado pelo rsync).
- Stack visível no Dockge: `/opt/stacks/finances/compose.yml`, cópia do
  `docker-compose.production.yml` do repositório. O `.env` daquele diretório
  define `FINANCES_APP_DIR=/dados/sites/finances/app`, que o compose usa como
  contexto de build e origem do `env_file`.
- Volume do banco: `finances_postgres_data`, **externo** ao Compose (criado na
  migração). O arquivo o declara como `external: true` para que o Compose não
  crie um volume novo por baixo e apresente um banco vazio.
- Rede: `finances_interna`. Porta publicada: `8092`. O Caddy do CT 102
  (`ct-proxy`) faz `reverse_proxy` de `finances.fellipecorreia.com` para
  `192.168.0.241:8092`.
- Backups automáticos do deploy: `/dados/sites/finances/backups` (os 10 mais
  recentes são mantidos).

Push em `main` dispara `.github/workflows/deploy.yml` no runner self-hosted com
o label `finances-saturno`. O checkout é feito com `git fetch` puro em vez de
`actions/checkout` porque o `codeload.github.com` devolve 429 com frequência
neste servidor. O script `scripts/deploy-production.sh`:

1. gera backup SQL do PostgreSQL em execução;
2. sincroniza o checkout para `/dados/sites/finances/app`, preservando `.env`;
3. confere que o volume externo do banco existe;
4. executa `docker compose -p finances -f docker-compose.production.yml up -d --build`;
5. aplica migrations no início do container;
6. copia o compose para `/opt/stacks/finances/compose.yml` (Dockge);
7. verifica `/api/version` contra o SHA esperado e depois testa `/login`.

O endpoint público `/api/version` informa o commit executado pelo contêiner.
O deploy falha se a imagem ativa não corresponder a `GITHUB_SHA`.

O runner é um serviço systemd dentro do CT 101, no padrão dos outros projetos
do servidor (`/opt/actions-runner-<projeto>`). Para registrar de novo:

```bash
# no host Proxmox
pct exec 101 -- bash
mkdir -p /opt/actions-runner-finances && cd /opt/actions-runner-finances
curl -fsSL -o runner.tar.gz https://github.com/actions/runner/releases/download/v<versao>/actions-runner-linux-x64-<versao>.tar.gz
tar xzf runner.tar.gz && rm runner.tar.gz
./config.sh --url https://github.com/f3ll1p3C0rr31a/finances \
  --token <registration-token> --name Saturno-Finances \
  --labels self-hosted,linux,x64,finances-saturno --work _work --unattended
./svc.sh install root && ./svc.sh start
```

Arquivos de referência:

- `.github/workflows/deploy.yml`;
- `scripts/deploy-production.sh`;
- `docker-compose.production.yml`;
- `Dockerfile`.

Não faça push, deploy, restore de banco ou alteração de produção sem pedido
explícito do usuário.

## Encerramento e passagem de contexto

Ao terminar trabalho significativo:

1. atualize `continuity.md` com objetivo, estado e validações;
2. registre bloqueios com evidência e próximo passo concreto;
3. mova decisões permanentes para `architecture.md` ou `workflow.md`;
4. evite transformar `continuity.md` em diário histórico infinito.
