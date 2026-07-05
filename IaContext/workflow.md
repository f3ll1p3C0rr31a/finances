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

Ainda não existe comando de testes automatizados. Para mudanças de cálculos,
considere adicionar testes antes de ampliar regras de alto risco.

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

Push em `main` dispara `.github/workflows/deploy.yml` no runner
`finances-jupiter`. O script:

1. tenta gerar backup SQL do PostgreSQL existente;
2. sincroniza o checkout para `/home/fellipecorreia/sites/finances/app`,
   preservando `.env`;
3. executa `docker compose ... up -d --build`;
4. aplica migrations no início do container;
5. verifica `http://127.0.0.1:8092/login`.

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
