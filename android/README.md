# Fortuna para Android

App nativo fino em volta do site: uma **TWA** (Trusted Web Activity) que abre
`finances.fellipecorreia.com` em tela cheia, sem barra de navegador, mais um
**widget** de tela inicial com o resumo do mês e um **lançamento rápido** de
compra de cartão.

> **Compilado e assinado** em 2026-08-19 com JDK 17, SDK 35 e Gradle 8.10.2.
> O APK de release sai em `app/build/outputs/apk/release/app-release.apk`.
> Não foi instalado em aparelho nenhum: o comportamento em tela — widget,
> notificação, lançamento rápido — ainda não foi visto rodando.

## Por que TWA e não um app nativo

O app inteiro já existe na web e muda toda semana. Reescrever as telas em
Kotlin significaria manter duas versões da mesma regra financeira. A TWA usa o
Chrome instalado para renderizar o site — atualizar o site atualiza o app — e o
código nativo fica restrito ao que a web não faz: o widget e o atalho de
lançamento.

## O que cada parte faz

| Arquivo | Papel |
| --- | --- |
| `LauncherActivity` (da biblioteca) | Abre o site em tela cheia |
| `OverviewWidget.kt` | Widget: saldo planejado, saldo atual, meta dos cartões e faturas em aberto |
| `QuickPurchaseActivity.kt` | Formulário de compra: valor, modo, cartão, parcelas |
| `SetupActivity.kt` | Cola o token do dispositivo e pede a permissão de notificação |
| `AgendaWorker.kt` | Aviso diário do que vence hoje e do que está em atraso |
| `FortunaApi.kt` | Chama `/api/widget/overview` e `/api/widget/purchase` |
| `TokenStore.kt` | Guarda token e endereço em SharedPreferences |

O widget e o formulário **não** usam a sessão do navegador: autenticam com um
token gerado no site em **Informações → Dispositivos**. Revogar o token lá
corta o acesso do aparelho sem derrubar o login da web.

## Build

Pré-requisitos: JDK 17 e SDK do Android com a plataforma 35. Se não tiver,
`~/android-toolchain/setup.sh` baixa tudo sem precisar de root (~900 MB) e não
mexe no sistema.

```bash
cd android
JAVA_HOME=~/android-toolchain/jdk ANDROID_HOME=~/android-toolchain/sdk \
  ./gradlew assembleRelease
```

Saídas:

- `app/build/outputs/apk/release/app-release.apk` — assinado, é o que se
  instala no aparelho
- `app/build/outputs/apk/debug/app-debug.apk` — para depurar

Instalar no aparelho conectado por USB (depuração USB ligada):

```bash
~/android-toolchain/sdk/platform-tools/adb install -r \
  app/build/outputs/apk/release/app-release.apk
```

Sem cabo: copie o APK para o celular e abra o arquivo; o Android vai pedir
para autorizar a instalação de fontes desconhecidas.

## A chave de assinatura

`fortuna.keystore` e `keystore.properties` ficam neste diretório e **não são
versionados**. Guarde uma cópia dos dois fora da máquina: sem essa chave o
Android recusa qualquer atualização do app já instalado — a única saída seria
desinstalar e perder a configuração.

A impressão digital SHA-256 dela é o que está publicado em
`ANDROID_APP_FINGERPRINT` no `.env` de produção.

## Digital Asset Links

Já configurado: a impressão digital da chave está no `.env` de produção e
`https://finances.fellipecorreia.com/.well-known/assetlinks.json` responde com
ela. É isso que faz o app abrir sem a barra do Chrome por cima.

Se um dia a chave mudar, refaça:

```bash
keytool -list -v -keystore fortuna.keystore -alias fortuna | grep SHA256
```

e atualize `ANDROID_APP_FINGERPRINT` no `.env` de produção — o container
precisa ser **recriado**, não só reiniciado, porque o `env_file` é lido na
criação.

Para depurar com o APK de debug, some a impressão da chave de debug
(`~/.android/debug.keystore`, alias `androiddebugkey`, senha `android`),
separando por vírgula.

A verificação acontece na instalação: se a barra continuar aparecendo,
desinstale antes de reinstalar, porque o Android guarda o resultado.

## Atualizar o app pelo Obtainium

O [Obtainium](https://github.com/ImranR98/Obtainium) vigia uma fonte de APK e
avisa quando sai versão nova — é o mais perto de uma loja sem precisar manter
repositório F-Droid próprio. A fonte aqui são as **Releases do GitHub**.

Configurar uma vez, no celular:

1. Instale o Obtainium (ele mesmo está na F-Droid, ou pelo APK do GitHub).
2. **Add App** e cole a URL do repositório:
   `https://github.com/f3ll1p3C0rr31a/finances`
3. Em **Filter APKs by Regular Expression**, use `fortuna-.*\.apk` — o
   repositório é do site inteiro, e sem o filtro o Obtainium tentaria adivinhar
   qual anexo é o app.
4. Marque para receber notificação de atualização.

Publicar uma versão nova, aqui na máquina:

```bash
# 1. suba versionCode e versionName em android/app/build.gradle.kts
# 2. publique
./scripts/release-android.sh --notes "o que mudou"
```

O script compila, confere que o APK saiu assinado (APK sem assinatura instala
uma vez e nunca mais atualiza) e cria a release com o APK anexado. Em poucos
minutos o Obtainium avisa no celular.

O build é local de propósito: a chave de assinatura nunca sai desta máquina.
Automatizar no GitHub Actions exigiria guardar o keystore nos Secrets, e o
repositório é público.

## Configurar o aparelho

1. No site, **Informações → Dispositivos**, gere um token e copie (ele só
   aparece uma vez).
2. Abra o app, toque no widget e cole o token na tela de configuração.
3. Adicione o widget "Fortuna" à tela inicial.

O widget se atualiza sozinho a cada 30 minutos — é o intervalo mínimo que o
Android permite — e tem um botão de atualizar para quando você quiser o número
na hora. Lançar uma compra também força a atualização.

As notificações começam a valer no dia seguinte: o aviso sai às 8h e lista o
que vence hoje e o que ficou em atraso. Se o Android pedir a permissão de
notificação, é preciso aceitar — sem ela o worker roda e não mostra nada.

## Limites conhecidos

- O `updatePeriodMillis` de 30 min é limite do sistema. Para tempo real seria
  preciso FCM (push), o que exige projeto no Firebase.
- O widget mostra o mês corrente; não navega entre meses.
- O lançamento rápido cria compras, não edita nem apaga — isso continua no
  site.
- Sem cache offline: sem rede, o widget mostra a mensagem de erro em vez de um
  valor possivelmente desatualizado.
- A notificação é local e diária, não push. Um lançamento criado hoje só
  aparece no aviso de amanhã. Tempo real exigiria FCM, e com ele um projeto no
  Firebase.
- Nada foi verificado rodando em aparelho: o APK compila e está assinado, mas
  widget, notificação e lançamento rápido ainda não foram vistos na tela.
