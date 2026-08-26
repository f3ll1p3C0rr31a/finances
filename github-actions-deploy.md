# Deploy automático com GitHub Actions e runner self-hosted

Guia para replicar, em outro projeto, a esteira de deploy usada aqui: um `git
push` na `main` publica a versão nova em produção sozinho, com backup do banco
antes e verificação de que o que subiu é realmente o commit certo.

Escrito para ser lido por uma IA (ou pessoa) que nunca viu o projeto. O que é
específico deste sistema está marcado como tal; o resto vale para qualquer app
que rode em Docker num servidor próprio.

---

## 1. A decisão de arquitetura

Existem dois jeitos de o GitHub publicar num servidor seu:

| | Runner self-hosted | Runner do GitHub + SSH |
| --- | --- | --- |
| Onde o job roda | Dentro do seu servidor | Na nuvem do GitHub |
| Como alcança a produção | Já está lá | Precisa abrir SSH para a internet |
| Segredos necessários | Nenhum | Chave SSH privada nos Secrets |
| Servidor atrás de NAT/CGNAT | Funciona | Não funciona sem túnel |
| Custo em repo privado | Zero | Consome minutos |

**Escolha aqui: runner self-hosted.** O servidor é doméstico, atrás de NAT, e
não tem porta SSH exposta. O runner abre uma conexão *de dentro para fora* e
fica aguardando trabalho — não é preciso abrir nada no roteador nem guardar
chave privada em lugar nenhum.

A contrapartida: o runner é um processo que você mantém. Se o servidor
reiniciar e o serviço não subir, o deploy silenciosamente para de acontecer —
os jobs ficam enfileirados esperando um runner que não existe. Por isso ele
roda como serviço systemd, com restart automático.

---

## 2. Pré-requisitos

No servidor:

- Docker e Docker Compose
- `rsync`, `curl`, `tar`
- Um diretório para o checkout e outro para backups
- O `.env` de produção **já criado** (ele nunca vem do repositório)

No repositório:

- Um `Dockerfile` que constrói a aplicação
- Um arquivo Compose de produção
- Permissão de administrador (para registrar o runner)

---

## 3. Passo 1 — registrar o runner

O runner é por repositório (contas pessoais não têm runners de organização).

```bash
# 1. Pegue um registration token (vale 1 hora)
gh api -X POST repos/<owner>/<repo>/actions/runners/registration-token --jq .token

# 2. No servidor, baixe e extraia
V=$(curl -fsSL https://api.github.com/repos/actions/runner/releases/latest \
  | grep -oP '(?<="tag_name": "v)[0-9.]+' | head -1)
mkdir -p /opt/actions-runner-<projeto> && cd /opt/actions-runner-<projeto>
curl -fsSL -o runner.tar.gz \
  "https://github.com/actions/runner/releases/download/v$V/actions-runner-linux-x64-$V.tar.gz"
tar xzf runner.tar.gz && rm runner.tar.gz

# 3. Configure
export RUNNER_ALLOW_RUNASROOT=1   # só se for rodar como root
./config.sh --url https://github.com/<owner>/<repo> \
  --token <registration-token> \
  --name <Servidor-Projeto> \
  --labels self-hosted,linux,x64,<projeto>-<servidor> \
  --work _work --unattended --replace

# 4. Suba como serviço
./svc.sh install root && ./svc.sh start
```

Confirme que ficou online:

```bash
gh api repos/<owner>/<repo>/actions/runners \
  --jq '.runners[] | "\(.name) | \(.status) | \([.labels[].name]|join(","))"'
```

### Sobre os labels

O label específico (`<projeto>-<servidor>`) é o que amarra o workflow àquele
servidor. Use um nome que diga **onde** o runner está, não o que ele faz.

> **Armadilha vivida.** Este projeto migrou de servidor e o label antigo
> (`finances-jupiter`) continuou no workflow. Resultado: todo push ficava
> enfileirado esperando um runner que não existia mais, sem erro visível — o
> deploy simplesmente não acontecia. Ao trocar de servidor, troque o label e
> remova o runner antigo (`gh api -X DELETE .../actions/runners/<id>`).

---

## 4. Passo 2 — o workflow

`.github/workflows/deploy.yml`:

```yaml
name: Deploy <Projeto>

on:
  push:
    branches: [main]
  workflow_dispatch:        # permite disparar à mão pela interface

concurrency:
  group: <projeto>-production
  cancel-in-progress: false  # nunca cancelar um deploy pela metade

permissions:
  contents: read

jobs:
  deploy:
    name: Deploy production
    runs-on: [self-hosted, linux, x64, <projeto>-<servidor>]

    steps:
      # Checkout com git puro em vez de actions/checkout: baixar a action
      # passa por codeload.github.com, que devolve 429 (Too Many Requests) com
      # frequência em IP residencial e derruba o job antes de rodar qualquer
      # coisa nossa. git fetch usa github.com, que não sofre desse limite.
      - name: Checkout
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          set -Eeuo pipefail
          mkdir -p "$GITHUB_WORKSPACE"
          cd "$GITHUB_WORKSPACE"
          if [ ! -d .git ]; then
            git init -q
            git remote add origin "https://github.com/${GITHUB_REPOSITORY}.git"
          else
            git remote set-url origin "https://github.com/${GITHUB_REPOSITORY}.git"
          fi
          AUTH=$(printf 'x-access-token:%s' "$GH_TOKEN" | base64 -w0)
          git -c http.extraheader="AUTHORIZATION: basic ${AUTH}" \
            fetch --depth 1 --no-tags origin "$GITHUB_SHA"
          git checkout -q --force FETCH_HEAD
          git clean -ffdxq
          git log --oneline -1

      - name: Deploy
        run: bash scripts/deploy-production.sh
```

Pontos que não são decoração:

- **`concurrency` sem `cancel-in-progress`** — dois deploys simultâneos
  disputam o mesmo diretório e o mesmo Compose. Cancelar um no meio é pior
  ainda: pode deixar o container parado.
- **`workflow_dispatch`** — permite redeployar sem inventar um commit vazio.
- **Checkout com `git fetch`** — só é necessário se você vir falhas 429 de
  `codeload.github.com`. Em runner na nuvem, `actions/checkout@v4` funciona bem.

---

## 5. Passo 3 — o script de deploy

O workflow deve ser fino; a lógica vive num script versionado, que também pode
ser rodado à mão no servidor quando preciso.

```bash
#!/usr/bin/env bash
set -Eeuo pipefail

BASE_DIR="/dados/sites/<projeto>"
APP_DIR="$BASE_DIR/app"
BACKUPS_DIR="$BASE_DIR/backups"
COMPOSE_FILE="docker-compose.production.yml"
PROJECT="<projeto>"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
WORKSPACE="${GITHUB_WORKSPACE:-$(pwd)}"
APP_COMMIT_SHA="${GITHUB_SHA:-$(git -C "$WORKSPACE" rev-parse HEAD)}"
export APP_COMMIT_SHA

mkdir -p "$APP_DIR" "$BACKUPS_DIR"

# 1. BACKUP ANTES DE QUALQUER COISA
echo "==> Backup do banco"
CID=$(docker ps -q --filter "name=^<projeto>-postgres$" || true)
if [ -n "$CID" ]; then
  docker exec "$CID" sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
    | gzip > "$BACKUPS_DIR/<projeto>-$TIMESTAMP.sql.gz"
  # mantém os 10 mais recentes
  ls -1t "$BACKUPS_DIR"/<projeto>-*.sql.gz | tail -n +11 | xargs -r rm --
else
  echo "Sem container de banco — primeiro deploy"
fi

# 2. SINCRONIZA O CÓDIGO, PRESERVANDO O QUE É DO SERVIDOR
echo "==> Sincronizando checkout"
rsync -a --delete \
  --exclude '.env' \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.git' \
  "$WORKSPACE/" "$APP_DIR/"

[ -f "$APP_DIR/.env" ] || { echo "ERRO: .env não existe" >&2; exit 1; }

# 3. TRAVAS DE SEGURANÇA
if ! docker volume inspect <projeto>_postgres_data >/dev/null 2>&1; then
  echo "ERRO: volume de dados não existe" >&2; exit 1
fi

# 4. SOBE
echo "==> Build e restart"
cd "$APP_DIR"
docker compose -p "$PROJECT" -f "$COMPOSE_FILE" up -d --build
docker image prune -f

# 5. VERIFICA QUE SUBIU O COMMIT CERTO
echo "==> Health check"
for _ in $(seq 1 60); do
  RESP=$(curl -sf http://127.0.0.1:<porta>/api/version 2>/dev/null || true)
  if [[ "$RESP" == *"\"commit\":\"$APP_COMMIT_SHA\""* ]]; then
    curl -sf http://127.0.0.1:<porta>/login >/dev/null && {
      echo "OK para $APP_COMMIT_SHA"; exit 0; }
  fi
  sleep 2
done

echo "FALHOU — commit esperado: $APP_COMMIT_SHA, obtido: ${RESP:-nada}" >&2
docker compose -p "$PROJECT" -f "$COMPOSE_FILE" logs --tail 50 app
exit 1
```

### A ordem importa

1. **Backup primeiro.** Se o deploy quebrar o banco, o backup já existe. Depois
   é tarde.
2. **`rsync --delete` com exclusões.** O `--delete` garante que arquivo removido
   do repositório some do servidor. As exclusões protegem o que pertence ao
   servidor (`.env`) e o que é gerado (`node_modules`, build).
3. **Travas antes de subir**, não depois.
4. **Health check por último**, e que faça o job falhar de verdade.

---

## 6. O endpoint de versão — a peça mais subestimada

```ts
// app/api/version/route.ts
export const dynamic = "force-dynamic"

export function GET() {
  return Response.json(
    { commit: process.env.APP_COMMIT_SHA ?? "unknown" },
    { headers: { "Cache-Control": "no-store" } }
  )
}
```

O SHA entra na imagem em tempo de build:

```dockerfile
ARG APP_COMMIT_SHA=unknown
ENV APP_COMMIT_SHA=$APP_COMMIT_SHA
```

```yaml
build:
  args:
    APP_COMMIT_SHA: ${APP_COMMIT_SHA:-unknown}
```

**Por que isso vale tanto:** sem ele, "o deploy passou" significa apenas que
nenhum comando retornou erro. Com ele, significa que *o processo que está
respondendo na porta é o código daquele commit*. Pega cache de imagem antiga,
container que não foi recriado, build que falhou mas o container velho
continuou de pé — a classe inteira de "deploy verde, produção velha".

Foi assim que se descobriu, neste projeto, que a imagem em produção rodava com
`APP_COMMIT_SHA=unknown`: tinha sido construída à mão numa migração de
servidor, e nenhum deploy real havia acontecido desde então.

---

## 7. Armadilhas do Docker Compose

Todas custaram tempo real neste projeto.

### 7.1 Volume nomeado ganha prefixo do projeto

```yaml
volumes:
  meu_postgres_data:      # vira "<projeto>_meu_postgres_data"
```

Se o volume foi criado fora do Compose (numa migração de servidor, por
exemplo) e se chama `meu_postgres_data`, o Compose **não vai usá-lo**: cria um
novo, vazio, com o nome prefixado. A aplicação sobe com banco zerado e o deploy
passa no health check.

```yaml
volumes:
  meu_postgres_data:
    external: true        # usa exatamente este nome
```

E no script, a trava que aborta se ele não existir. Um volume "quase certo" é
pior do que um erro.

### 7.2 `env_file` é lido na **criação** do container

Alterar o `.env` e reiniciar **não** aplica nada. É preciso recriar:

```bash
docker compose -p <projeto> -f <compose> up -d --force-recreate <serviço>
```

Sintoma típico: você adiciona uma variável, reinicia, e a aplicação insiste que
ela não existe.

### 7.3 Caminhos relativos dependem de onde o Compose roda

Se o mesmo arquivo é usado pelo deploy (a partir do checkout) e por uma
interface como Dockge (a partir de outro diretório), `context: .` aponta para
lugares diferentes. Resolva com variável:

```yaml
build:
  context: ${APP_DIR:-.}
env_file:
  - ${APP_DIR:-.}/.env
```

E defina `APP_DIR` no `.env` do outro diretório.

---

## 8. Migrations no deploy

Rode a migration no **start do container**, não no script de deploy:

```dockerfile
CMD ["sh", "-c", "npx prisma migrate deploy && npx next start -H 0.0.0.0 -p 3000"]
```

Assim ela roda com a mesma imagem e o mesmo ambiente da aplicação, e um restart
manual também aplica o que faltar.

> **Armadilha vivida.** Uma feature foi revertida com `git revert`, o que
> apagou a pasta da migration correspondente — mas ela **já estava aplicada em
> produção**. O histórico do banco passou a divergir do diretório de migrations.
>
> A correção não é apagar a linha do `_prisma_migrations`: é restaurar a
> migration no repositório e adicionar uma nova que a desfaz. Migration aplicada
> é fato consumado; o caminho para trás é sempre para a frente.

---

## 9. Segredos e variáveis

- **O `.env` de produção nunca entra no Git** e é preservado pelo `rsync
  --exclude`. Ele é criado à mão na primeira vez.
- **`.env.example` versionado**, documentando cada variável.
- Segredos do *workflow* (se houver) vão em Settings → Secrets. Com runner
  self-hosted, normalmente não é preciso nenhum: o servidor já tem o que
  precisa.
- Ao remover uma feature, **limpe as variáveis dela** do `.env` e revogue as
  credenciais no provedor.

---

## 10. Problemas reais e o que significam

| Sintoma | Causa | Correção |
| --- | --- | --- |
| Job fica "Queued" para sempre | Nenhum runner com aquele label | Conferir `gh api .../actions/runners`; label errado ou serviço parado |
| `429 Too Many Requests` no checkout | `codeload.github.com` limitando o IP | Checkout com `git fetch` (seção 4) |
| Deploy verde, produção velha | Container não recriado ou cache de build | Health check por `/api/version` |
| Banco aparece vazio | Volume prefixado pelo Compose | `external: true` + trava no script |
| Variável nova não existe na app | `env_file` lido na criação | `--force-recreate` |
| `GH007: push would publish a private email` | Commit com e-mail privado | Usar `<id>+<user>@users.noreply.github.com` |
| Migration "missing from local directory" | Migration revertida no Git, aplicada no banco | Restaurar a migration e criar outra que a desfaz |

---

## 11. Checklist para replicar num projeto novo

```
[ ] Servidor com Docker, rsync e diretórios de app/backup criados
[ ] .env de produção criado à mão no servidor
[ ] Volume de dados existente declarado como external no Compose
[ ] Endpoint /api/version devolvendo APP_COMMIT_SHA
[ ] Dockerfile com ARG/ENV APP_COMMIT_SHA e migration no CMD
[ ] Runner registrado, com label <projeto>-<servidor>, rodando como serviço
[ ] Runner antigo removido, se houve migração
[ ] Workflow com concurrency sem cancel-in-progress
[ ] Script de deploy: backup → rsync → travas → up --build → health check
[ ] Primeiro deploy disparado por workflow_dispatch, acompanhando o log
[ ] Confirmado que /api/version responde o commit novo
```

---

## 12. Como verificar que funcionou de verdade

Não confie no ✅ do GitHub. Confira no servidor:

```bash
# o commit que está rodando
curl -s http://127.0.0.1:<porta>/api/version

# comparado com o topo da main
git log --oneline -1

# containers de pé, sem reinícios
docker ps --filter name=<projeto>
docker inspect <projeto>-app --format 'restarts={{.RestartCount}} exit={{.State.ExitCode}}'

# o backup daquele deploy existe
ls -lt /dados/sites/<projeto>/backups | head -3

# a aplicação responde pelo domínio público
curl -s -o /dev/null -w '%{http_code}\n' https://<dominio>/login
```

Se qualquer um discordar dos outros, o deploy não terminou — independentemente
do que o workflow disse.
