> **OBSOLETO — não siga este documento.**
>
> Ele descreve a infraestrutura do **ClassLog**, não a deste projeto, e ficou
> desatualizado depois da migração de servidor de agosto/2026. Está mantido
> apenas como referência histórica.
>
> O guia correto e atual é **[github-actions-deploy.md](github-actions-deploy.md)**.
> Para a operação específica deste sistema, veja `IaContext/workflow.md`.

---

# Guia de Deploy — Infraestrutura Reutilizável

Este guia explica a arquitetura de deploy usada no ClassLog e como replicá-la para
um sistema diferente. Ele é escrito para ser lido por uma IA (ou humano) que nunca
viu esse projeto antes.

---

## 0. Verifique o ambiente antes de qualquer coisa

O usuário desenvolve em **múltiplas máquinas** (às vezes Windows, às vezes Linux).
O que está configurado numa máquina pode não existir em outra. Antes de assumir que
tudo funciona, rode estes checks:

```bash
# 1. Em qual máquina estou?
uname -n          # Linux: hostname da máquina
$env:COMPUTERNAME # Windows PowerShell

# 2. O git está apontando para o repo certo?
git remote -v

# 3. O gh CLI está instalado e autenticado?
gh auth status
# Saída esperada: "Logged in to github.com account <usuario>"
# Se falhar: ver seção "Autenticação com gh CLI" abaixo

# 4. O credential helper do git está configurado?
git config --get credential.helper
# Esperado: algo como "!/usr/bin/gh auth git-credential"
# Se estiver vazio: rodar "gh auth setup-git" (ver abaixo)

# 5. Tem node instalado? (necessário para validação local)
node --version
```

Se qualquer check acima falhar, resolva antes de tentar commitar/fazer push.
Um push sem autenticação configurada vai travar silenciosamente ou pedir senha
que não existe.

---t

## 1. Arquitetura geral

```
[desenvolvedor / IA]
       │
   git push
       │
  GitHub.com ─── Actions Workflow (.github/workflows/deploy.yml)
       │
   dispara job no runner self-hosted
       │
  Servidor "Jupiter" (192.168.0.10 / Tailscale)
  └── GitHub Actions Runner (serviço systemd)
        │  checkout do repo
        │  validações (node --check, npm audit)
        │  scripts/deploy-production.sh
        │    ├── staging + backup do diretório atual
        │    ├── copia arquivos para /home/.../sites/<app>/app/
        │    └── docker restart <container>
        └── health-check na porta do container
```

**Resumo**: não há deploy manual — `git push origin main` aciona tudo
automaticamente. O runner fica no servidor, então o código vai direto do GitHub
para produção sem precisar de acesso SSH externo.

---

## 2. GitHub: configuração do repositório

1. Crie o repositório em github.com (pode ser privado).
2. Configure a branch `main` como branch padrão.
3. O workflow de deploy vive em `.github/workflows/deploy.yml` (versionado junto
   com o código — nenhuma configuração adicional no painel do GitHub é necessária
   para o deploy em si).
4. Se o projeto precisar de segredos (API keys, tokens), adicione em
   **Settings → Secrets and variables → Actions → Repository secrets**. Eles ficam
   disponíveis no workflow como `${{ secrets.NOME_DO_SEGREDO }}`.

---

## 3. GitHub Actions — template do workflow

Adapte o arquivo abaixo para o novo projeto. Os pontos-chave estão comentados.

```yaml
name: Deploy <NomeDoProjeto>

on:
  push:
    branches: [main]
  workflow_dispatch:          # permite disparar manualmente no painel do GitHub

concurrency:
  group: <nome-do-projeto>-production
  cancel-in-progress: false   # nunca cancelar um deploy em andamento

env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true   # garante Node moderno no runner

jobs:
  deploy:
    name: Deploy production
    # Label do runner self-hosted — deve bater com o que foi registrado no servidor
    runs-on: [self-hosted, linux, x64, <label-do-runner>]

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      # Adicione aqui suas etapas de validação/build
      - name: Validate
        run: |
          node --check server.js
          # etc.

      - name: Deploy
        run: bash scripts/deploy-production.sh
```

**Label do runner**: escolha um nome único por projeto (ex.: `classlog-jupiter`,
`meuapp-jupiter`). Um servidor pode hospedar múltiplos runners com labels
diferentes — eles não interferem entre si.

---

## 4. Servidor — registrar o runner self-hosted

Faça isso **uma vez** no servidor, para cada novo projeto:

```bash
# No servidor (Jupiter / 192.168.0.10), como o usuário que vai rodar o serviço:

mkdir -p ~/actions-runners/<nome-do-projeto>
cd ~/actions-runners/<nome-do-projeto>

# Baixe o runner (versão atual em github.com/actions/runner/releases):
curl -o actions-runner-linux-x64.tar.gz -L https://github.com/actions/runner/releases/download/v2.x.x/actions-runner-linux-x64-2.x.x.tar.gz
tar xzf actions-runner-linux-x64.tar.gz

# Configure — o token de registro fica em:
#   github.com/<usuario>/<repo> → Settings → Actions → Runners → New self-hosted runner
./config.sh --url https://github.com/<usuario>/<repo> \
            --token <TOKEN_DE_REGISTRO> \
            --name <nome-do-runner> \
            --labels "self-hosted,linux,x64,<label-do-runner>" \
            --unattended

# Instale como serviço systemd (para rodar automaticamente após reboot):
sudo ./svc.sh install
sudo ./svc.sh start
sudo ./svc.sh status   # deve mostrar "active (running)"
```

> O token de registro expira em ~1 hora e é de uso único — só serve para o
> `./config.sh`. Depois disso o runner usa um token interno renovado
> automaticamente. Se o runner desregistrar, gere um novo token no painel.

---

## 5. Servidor — estrutura de diretórios e Docker

O padrão usado no ClassLog (replicável):

```
/home/fellipecorreia/sites/<app>/
├── app/               ← diretório de produção (o que o container monta)
│   ├── server.js
│   ├── data/
│   │   └── classlog-db.json   ← dados persistidos; NUNCA sobrescrever no deploy
│   └── ...
└── backups/           ← backups automáticos gerados pelo script de deploy
```

O container Docker monta `/home/fellipecorreia/sites/<app>/app` como volume e
expõe uma porta interna (ex.: 3000). O **Nginx Proxy Manager** (rodando em outro
container ou porta) faz o proxy reverso para o domínio público, gerencia HTTPS
(Let's Encrypt) e termina o TLS.

```bash
# Exemplo de como o container foi criado (referência — não rodar de novo):
docker run -d \
  --name <container-name> \
  --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  -v /home/fellipecorreia/sites/<app>/app:/app \
  node:lts-alpine \
  node /app/server.js
```

O deploy só faz `docker restart <container-name>` — ele não recria o container.
Isso preserva o volume de dados (`data/`) intacto.

---

## 6. Script de deploy — padrão seguro

O `scripts/deploy-production.sh` segue um padrão que protege os dados em produção:

1. **Staging**: copia os arquivos do checkout para um diretório temporário
   `.deploy-<SHA>-<timestamp>`.
2. **Validação pré-swap**: roda `node --check` nos arquivos staged. Se falhar,
   o script aborta antes de tocar em produção (graças ao `set -Eeuo pipefail`).
3. **Backup**: comprime o diretório `app/` atual em `backups/` com timestamp.
   **Importante**: verifica que `data/<db>.json` existe e não está vazio antes de
   continuar — evita sobrescrever dados com uma instalação vazia.
4. **Swap**: `cp -a staged/. app/` copia os novos arquivos.
5. **Restart**: `docker restart <container>`.
6. **Health-check**: tenta `/api/auth/me` (ou qualquer endpoint que responda 200)
   por até 30 segundos. Se não responder, despeja os logs do container e sai com
   erro — o GitHub Actions marca o job como falho.

```bash
# Variáveis de ambiente que o script respeita (para adaptar sem editar o script):
CLASSLOG_DEPLOY_BASE=/home/fellipecorreia/sites/classlog   # troque pelo novo path
```

Para um novo projeto: copie o script, substitua `classlog-api` pelo nome do
container, `classlog-db.json` pelo arquivo de dados, e os nomes de arquivo da
lista `FILES=(...)`.

---

## 7. Autenticação com gh CLI (git push sem senha)

Este é o passo que **mais varia entre máquinas**. Sempre verifique antes de assumir
que funciona.

### Verificar se já está configurado

```bash
gh auth status
# Esperado: "Logged in to github.com account <usuario> (keyring)"
# Se mostrar erro: siga os passos abaixo

git config --get credential.helper
# Esperado: "!/usr/bin/gh auth git-credential" (ou caminho similar)
```

### Configurar do zero (Linux — Arch/Ubuntu/Debian)

```bash
# Arch:
sudo pacman -S github-cli

# Ubuntu/Debian:
sudo apt install gh

# Autenticar (gera um device code — o usuário precisa confirmar no navegador):
# IMPORTANTE: rode em background com timeout ou numa aba separada,
# porque o comando fica bloqueado esperando a confirmação:
gh auth login --hostname github.com --git-protocol https --web
# O comando vai imprimir algo como:
#   ! First copy your one-time code: XXXX-XXXX
#   Press Enter to open github.com in your browser...
# Peça ao usuário para acessar github.com/login/device e digitar o código.
# Aguarde a confirmação antes de continuar.

# Configurar o git para usar o gh como credential helper:
gh auth setup-git
```

### Configurar do zero (Windows)

```powershell
# Via winget:
winget install GitHub.cli
# Ou baixe o instalador em cli.github.com

gh auth login --hostname github.com --git-protocol https --web
gh auth setup-git
```

### Verificar após configurar

```bash
gh auth status          # deve mostrar conta logada
git config --get credential.helper   # deve mostrar o helper do gh
git push origin main --dry-run       # deve funcionar sem pedir senha
```

> **Sem confirmação do usuário no navegador não há como autenticar.**
> Não tente inventar token, usar SSH ao acaso, ou forçar push — peça ao usuário
> para abrir github.com/login/device e digitar o código exibido pelo `gh auth login`.

---

## 8. Fluxo completo de deploy (checklist)

Para cada alteração que precisa ir a produção:

```bash
# 1. Verificar ambiente (seção 0)
gh auth status && git config --get credential.helper

# 2. Commitar as alterações
git add <arquivos>
git commit -m "descrição da mudança"

# 3. Push — isso aciona o deploy automaticamente
git push origin main

# 4. Acompanhar no GitHub Actions
#    github.com/<usuario>/<repo>/actions
#    O job deve aparecer em ~10 segundos e completar em ~1-2 minutos

# 5. Verificar produção
#    Acesse o domínio/IP e confirme que a mudança chegou
```

Não há nenhum passo manual no servidor — se o push chegou ao GitHub e o runner
está online, o deploy acontece sozinho.

---

## 9. Diagnóstico rápido quando algo não funciona

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| `git push` pede usuário/senha | `credential.helper` não configurado | `gh auth setup-git` |
| `git push` falha com "could not read Username" | `gh` não instalado ou não autenticado | Instalar `gh` + `gh auth login` |
| Job no Actions não aparece | Push não chegou no GitHub | Verifique `git log --oneline origin/main` |
| Job falha em "checkout" | Runner offline ou desregistrado | `sudo ./svc.sh status` no servidor |
| Container não sobe | Erro no código novo | `docker logs <container> --tail 50` |
| Deploy OK mas mudança não aparece | Cache do Service Worker (se PWA) | Suba `CACHE_NAME` no `service-worker.js` |

---

## 10. Exemplo concreto: ClassLog

| Componente | Valor no ClassLog |
|---|---|
| Repositório | `https://github.com/f3ll1p3C0rr31a/ClassLog` |
| Runner label | `classlog-jupiter` |
| Servidor | Jupiter — `192.168.0.10` (LAN) / Tailscale |
| Container | `classlog-api` (porta 3000 interna) |
| Dir. produção | `/home/fellipecorreia/sites/classlog/app` |
| Dados | `data/classlog-db.json` |
| Workflow | `.github/workflows/deploy.yml` |
| Script de deploy | `scripts/deploy-production.sh` |

Para um novo projeto: troque esses valores mantendo a estrutura das seções 3–6.
