# Fortuna para Android

App nativo fino em volta do site: uma **TWA** (Trusted Web Activity) que abre
`finances.fellipecorreia.com` em tela cheia, sem barra de navegador, mais um
**widget** de tela inicial com o resumo do mês e um **lançamento rápido** de
compra de cartão.

> **Este projeto não foi compilado.** A máquina onde ele foi escrito não tem
> JDK nem SDK do Android. O código está completo e segue as APIs padrão, mas
> espere ajustes de versão de dependência no primeiro build — abra no Android
> Studio, deixe ele sincronizar e corrija o que apontar.

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
| `SetupActivity.kt` | Cola o token do dispositivo |
| `FortunaApi.kt` | Chama `/api/widget/overview` e `/api/widget/purchase` |
| `TokenStore.kt` | Guarda token e endereço em SharedPreferences |

O widget e o formulário **não** usam a sessão do navegador: autenticam com um
token gerado no site em **Informações → Dispositivos**. Revogar o token lá
corta o acesso do aparelho sem derrubar o login da web.

## Build

Pré-requisitos: Android Studio (ou JDK 17 + SDK do Android com plataforma 35).

```bash
cd android
./gradlew assembleDebug        # gera app/build/outputs/apk/debug/app-debug.apk
```

Instalar no aparelho conectado:

```bash
./gradlew installDebug
```

Não há wrapper commitado; o Android Studio cria o `gradlew` na primeira
abertura. Por linha de comando, gere com `gradle wrapper` (Gradle 8.9+).

## Release e Digital Asset Links

Sem os asset links o app funciona, mas abre com a barra do Chrome por cima do
site. Para eliminá-la:

1. Crie a chave de assinatura, se ainda não existir:

   ```bash
   keytool -genkey -v -keystore fortuna.keystore -alias fortuna \
     -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Pegue a impressão digital SHA-256:

   ```bash
   keytool -list -v -keystore fortuna.keystore -alias fortuna | grep SHA256
   ```

3. Coloque no `.env` de produção do site e reinicie o container:

   ```
   ANDROID_APP_FINGERPRINT="AA:BB:CC:..."
   ```

   Durante os testes vale incluir também a chave de debug
   (`~/.android/debug.keystore`, alias `androiddebugkey`, senha `android`),
   separando por vírgula.

4. Confirme que `https://finances.fellipecorreia.com/.well-known/assetlinks.json`
   responde com o JSON — o site serve por um rewrite para `/api/assetlinks`.

5. Reinstale o app. A verificação acontece na instalação; se a barra
   continuar, desinstale antes de reinstalar (o Android guarda o resultado).

## Configurar o aparelho

1. No site, **Informações → Dispositivos**, gere um token e copie (ele só
   aparece uma vez).
2. Abra o app, toque no widget e cole o token na tela de configuração.
3. Adicione o widget "Fortuna" à tela inicial.

O widget se atualiza sozinho a cada 30 minutos — é o intervalo mínimo que o
Android permite — e tem um botão de atualizar para quando você quiser o número
na hora. Lançar uma compra também força a atualização.

## Limites conhecidos

- O `updatePeriodMillis` de 30 min é limite do sistema. Para tempo real seria
  preciso FCM (push), o que exige projeto no Firebase.
- O widget mostra o mês corrente; não navega entre meses.
- O lançamento rápido cria compras, não edita nem apaga — isso continua no
  site.
- Sem cache offline: sem rede, o widget mostra a mensagem de erro em vez de um
  valor possivelmente desatualizado.
