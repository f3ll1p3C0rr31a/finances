# Continuidade

Atualizado em: 2026-08-18

## Estado atual

### Objetivo

Descartar a integração Pluggy (open finance), reativar o deploy automático
depois da migração do servidor Jupiter → Saturno, e corrigir três pontos de
leitura do app: saldo planejado impreciso, cartões mostrando a fatura já
fechada e valores incertos visualmente confundidos com os confirmados.

### Alterações realizadas

- **Pluggy descartado.** O commit `eab114a` já havia sido revertido em
  `f284148`; nenhuma referência restou no código. Motivo do descarte: as
  conexões com os bancos caíam o tempo todo e exigiam reconexão manual.
  - O revert apagou também a pasta da migration `20260709120000_pluggy_integration`,
    que **já estava aplicada em produção** — o histórico do banco ficou
    divergente do diretório de migrations. Corrigido do jeito padrão do Prisma:
    a migration foi restaurada no repositório e uma nova,
    `20260818120000_drop_pluggy_integration`, remove as três tabelas
    (`PluggyConnection`, `PluggyAccountLink`, `PluggyImportedTransaction`) e os
    dois enums. Aquela migration só criava objetos novos, então nada de dados
    reais depende dela.
  - O `.env` de produção ainda tem `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`,
    `PLUGGY_WEBHOOK_SECRET` e `APP_PUBLIC_URL` — remover e revogar as
    credenciais no painel do Pluggy.
- **Deploy para o Saturno.** `docker-compose.production.yml` reescrito para o
  que roda hoje no CT 101 (`container_name`, rede `interna`, `TZ`, volume
  `finances_postgres_data` como `external`, caminhos via `FINANCES_APP_DIR`);
  `scripts/deploy-production.sh` passou de `/home/fellipecorreia/sites/finances`
  para `/dados/sites/finances`, sincroniza o compose com
  `/opt/stacks/finances` (Dockge), poda imagens e mantém 10 backups;
  `.github/workflows/deploy.yml` trocou o label `finances-jupiter` por
  `finances-saturno` e o `actions/checkout` por `git fetch` puro (o
  `codeload.github.com` devolve 429 neste servidor, como no site-fatima).
- **Saldo planejado.** `computePlannedBalance()` mudou de
  `abertura + entradas - saídas` para
  `saldo atual + entradas futuras - saídas futuras`. Nova
  `getMonthOpenCashflow()` centraliza a composição das futuras. A cadeia de
  saldos passou a herdar sempre o fechamento planejado (antes usava
  `actualBalance` cru, ignorando o que ficara em aberto).
- **Incertos fora das futuras.** `computeOpenCashflow()` deixou de somar
  incertos pendentes; sem isso o novo planejado os contaria e a prévia os
  contaria de novo.
- **Fatura em aberto nos cartões.** Nova `openInvoiceMonth()` e
  `getCardsOpenInvoiceSummary()`. `/cards` sem `month` mostra, por cartão, a
  fatura que ainda acumula compras (cada um no seu ciclo);
  `/cards/[cardId]` sem `month` abre nela. Com `month` na URL, tudo volta a
  seguir o mês escolhido. Dashboard inalterado de propósito.
- **Cores.** `MoneyTone` em `format.ts`: incerto pendente em azul (positivo) /
  roxo (negativo), conta de terceiro em cinza apagado. `MoneyText` ganhou
  `tone`; tabelas de entrada/despesa e o bloco de prévia do painel de saldo
  usam os novos tons, e as badges "Incerta" e de terceiro acompanham a cor.

### Decisões e motivos

- O dashboard continua exibindo a fatura que **vence** no mês: ali o número é
  saída de caixa do mês, e mudá-lo descasaria fluxo de caixa, saídas futuras e
  meta de gastos.
- Conta de terceiro ganhou cinza mas **continua somando** nos totais do mês
  (comportamento anterior preservado); se a intenção for excluí-la do saldo,
  é outra mudança, de regra.
- Volume do Postgres declarado como `external`: com `-p finances` e volume
  interno, o Compose criaria `finances_finances_postgres_data` e o app subiria
  com banco vazio.

### Validações executadas

- `npx tsc --noEmit`, `npm run lint`, `npm run build` (Next.js 16.2.9):
  passaram em 2026-08-18.
- `npx tsx scripts/test-balance-domain.ts` (novo, puro, sem banco): 28
  asserções sobre saldo planejado (mês intocado equivale à regra antiga; valor
  pago diferente do previsto; saldo corrigido à mão; incertos entrando só na
  prévia; mês liquidado devolvendo o próprio saldo atual) e sobre a fatura em
  aberto (Nubank antes/no dia/depois do fechamento, virada de ano, ciclo
  23/1, fechamento 31 em fevereiro, cartão sem fechamento). Todas passaram.
- Sem Docker na máquina de desenvolvimento: não houve smoke test local com
  banco.
- Deploy em produção executado em 2026-08-19 pelo workflow (run 32245438171,
  51s, commit `23a077d`): backup gerado, build, containers recriados, health
  check do `/api/version` batendo com o SHA e `/login` 200. Confirmado no
  servidor: volume `finances_postgres_data` preservado (69 despesas, 48
  compras, 22 meses), migration `20260818120000_drop_pluggy_integration`
  aplicada, tabelas Pluggy removidas (24 → 21 tabelas) e
  `https://finances.fellipecorreia.com/login` respondendo 200.
- Runner `Saturno-Finances` (label `finances-saturno`) ativo como serviço
  systemd no CT 101; o registro antigo `Jupiter-finances` foi removido.

### Ajustes posteriores (2026-08-19)

**Saldo herdado — decidido em definitivo.** O usuário pediu primeiro para o mês
seguinte herdar o saldo atual, e em seguida reverteu: o saldo inicial é o
**fechamento planejado** do mês corrente, porque no meio do mês o saldo atual
ainda não sofreu os descontos e recebimentos que faltam até o dia 31. A ida e
volta está registrada na docstring de `plannedClosingBalance()` — confirmar com
o usuário antes de inverter de novo. Efeito colateral bom: como pagar uma conta
derruba o saldo atual e tira o mesmo valor das saídas futuras, o valor herdado
não se mexe, então já está estável antes do fim do mês.

**Herança de recorrentes** (`src/lib/services/recurringEntries.ts`): mês novo
nasce copiando o mês anterior em vez do template, e editar um recorrente
propaga para os meses seguintes ainda abertos. Motivador: mudar a van escolar
de 400 para 600 em agosto não chegava em setembro, e trocar a NeoEnergia para
"Terceiros" também não. Meses encerrados e lançamentos pagos nunca são
reescritos.

**Diálogos**: `DialogContent` ganhou `max-h-[calc(100dvh-2rem)]` +
`overflow-y-auto` — sem isso um formulário alto passava da viewport e o botão
de salvar ficava inalcançável, porque o popup é `fixed` e não rolava. Os
formulários longos também ficaram mais largos no desktop
(`sm:max-w-lg`/`xl`/`2xl`), o que reduz a altura.

**Scripts de manutenção** novos: `recalculate-balance-chain.ts` e
`apply-recurring-inheritance.ts`.

### Sessão de 2026-08-19 (segunda leva)

- **Herança seletiva**: `traitsToInherit()` só reescreve o mês futuro que ainda
  está com o valor antigo, campo a campo. Decisão do usuário depois de ver a
  primeira versão sobrescrever tudo.
- **Ícone e PWA**: `scripts/generate-icons.mjs` gera todos os ícones (web e
  Android) a partir da moeda de `fortuna-logo.tsx`; `manifest.ts`, `icon.svg`,
  `apple-icon.png`, metadados de viewport/tema e um service worker
  conservador. Sessão passou de 30 dias para um ano.
- **Fuso horário (bug real)**: "hoje" era lido em UTC, então das 21h do dia 31
  em diante o app já operava no mês seguinte. `today()` agora decide em
  `America/Sao_Paulo` e aceita um instante, o que tornou a virada testável.
- **Widget do Android**: modelo `DeviceToken` (só o hash), rotas
  `/api/widget/overview` e `/api/widget/purchase`, UI de gerar/revogar em
  Informações. `createCardPurchaseForUser()` foi extraído para que web e
  widget usem exatamente a mesma regra.
- **Projeto Android** em `android/`: TWA + widget + lançamento rápido.
  **Nunca foi compilado** — não há JDK nem SDK nesta máquina. Ver o aviso no
  `android/README.md`.
- **Autorização**: `assertOwnedCard()` / `assertOwnedPixKey()` passaram a
  validar as chaves estrangeiras que as Server Actions gravam (antes só a
  posse do registro editado era conferida).

### Terceira leva (2026-08-19)

- **Terceiros fora do saldo**: `movesOwnMoney()` é o predicado único; conta de
  terceiro virou só controle. Cuidado registrado em `architecture.md`: trocar
  quem paga numa despesa já paga precisa ajustar o saldo nos dois sentidos.
- **Notificações**: `/api/widget/agenda` + `AgendaWorker` diário às 8h
  (WorkManager, notificação local, sem Firebase).
- **APK compilado e assinado**. Toolchain local em `~/android-toolchain`
  (JDK 17, SDK 35, Gradle 8.10.2), instalada por
  `scripts/android-toolchain-setup.sh` sem root. Chave em
  `android/fortuna.keystore` + `android/keystore.properties`, ambos fora do
  versionamento — **precisam de backup**, sem eles não dá para atualizar o app
  instalado.
- Impressão digital publicada em `ANDROID_APP_FINGERPRINT`;
  `/.well-known/assetlinks.json` responde em produção.
- Dois erros que só o compilador pegaria: `Result` próprio sombreando o
  `kotlin.Result` do `runCatching`, e comentário de bloco **aninhado** (Kotlin
  aceita) — o `/*` dentro de `` `/api/widget/*` `` num KDoc engolia o arquivo.

### Quarta leva (2026-08-20)

- **Widget redesenhado** no padrão Material 3: mesmas informações, hierarquia
  de leitura (rótulo pequeno / número grande / apoio), divisórias e barra de
  progresso na meta. `RemoteViews` não troca a cor do progresso em tempo de
  execução, então são **duas barras sobrepostas** — a vermelha substitui a roxa
  quando a meta estoura. Paleta com `values-night`: o widget segue o modo
  escuro do sistema, não o do app.
- **Lançamento rápido reescrito** com `TextInputLayout` outlined, dropdowns do
  Material e chips de filtro para etiquetas. As duas activities passaram a
  estender `AppCompatActivity` — componentes do Material 3 dependem do inflater
  do AppCompat e num `Activity` puro caem no fallback do framework, que era a
  causa do visual antigo.
- **Etiquetas no widget**: `/api/widget/overview` devolve a lista junto (evita
  segunda chamada) e `/api/widget/purchase` aceita `tagIds`, conferindo a posse
  antes de gravar.
- Distribuição por **Obtainium** lendo as Releases do GitHub;
  `scripts/release-android.sh` compila, confere a assinatura e publica.
  Releases `android-v1.1` e `android-v1.2` no ar.

### Pendências ou próximo passo

- Instalada a 1.2, conferir na tela: barra da meta (hoje em 116%, deve sair
  vermelha), chips de etiqueta e o visual do formulário.
- Com 23 etiquetas cadastradas, o ChipGroup ocupa bastante altura. Se
  incomodar, vale ordenar por mais usadas ou dar um campo de busca.
- A notificação de vencimento (`AgendaWorker`) nunca foi vista disparando.

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
