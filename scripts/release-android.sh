#!/usr/bin/env bash
set -Eeuo pipefail

# Publica o APK como uma Release do GitHub, que é de onde o Obtainium
# (https://github.com/ImranR98/Obtainium) puxa as atualizações no celular.
#
# O build é local de propósito: assim a chave de assinatura nunca sai desta
# máquina. Automatizar no CI exigiria guardar o keystore nos Secrets do
# GitHub, e o repositório é público.
#
#   ./scripts/release-android.sh            # publica a versão que está no build.gradle
#   ./scripts/release-android.sh --notes "o que mudou"

cd "$(dirname "$0")/.."
ANDROID_DIR="android"
GRADLE_FILE="$ANDROID_DIR/app/build.gradle.kts"

export JAVA_HOME="${JAVA_HOME:-$HOME/android-toolchain/jdk}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/android-toolchain/sdk}"
# apksigner é um script que chama `java`; sem isto ele sai em silêncio.
export PATH="$JAVA_HOME/bin:$PATH"

if [ ! -x "$JAVA_HOME/bin/java" ]; then
  echo "ERRO: JDK não encontrado em $JAVA_HOME. Rode scripts/android-toolchain-setup.sh." >&2
  exit 1
fi
if [ ! -f "$ANDROID_DIR/keystore.properties" ]; then
  echo "ERRO: $ANDROID_DIR/keystore.properties não existe — o APK sairia sem assinatura." >&2
  exit 1
fi

VERSION_NAME=$(grep -oP 'versionName = "\K[^"]+' "$GRADLE_FILE")
VERSION_CODE=$(grep -oP 'versionCode = \K\d+' "$GRADLE_FILE")
TAG="android-v$VERSION_NAME"

echo "==> Versão $VERSION_NAME (código $VERSION_CODE), tag $TAG"

if gh release view "$TAG" >/dev/null 2>&1; then
  echo "ERRO: a release $TAG já existe. Suba versionCode e versionName em $GRADLE_FILE." >&2
  exit 1
fi

echo "==> Compilando"
(cd "$ANDROID_DIR" && ./gradlew --quiet assembleRelease)

APK="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
NAMED="fortuna-$VERSION_NAME.apk"
cp "$APK" "/tmp/$NAMED"

# Confere que saiu assinado: um APK sem assinatura instala uma vez e nunca
# mais atualiza, porque o Android exige a mesma chave.
# Pode haver mais de uma versão de build-tools instalada; usa a mais recente.
APKSIGNER=$(find "$ANDROID_HOME/build-tools" -maxdepth 2 -name apksigner -type f | sort -V | tail -1)
FINGERPRINT=$("$APKSIGNER" verify --print-certs "/tmp/$NAMED" 2>/dev/null |
  grep -i "SHA-256 digest" | head -1 | awk '{print $NF}')
if [ -z "$FINGERPRINT" ]; then
  echo "ERRO: o APK não está assinado." >&2
  exit 1
fi
echo "==> Assinado por $FINGERPRINT"

# Aceita tanto `--notes "texto"` quanto o texto solto como primeiro argumento;
# antes, qualquer forma diferente de `--notes` era ignorada em silêncio.
if [ "${1:-}" = "--notes" ]; then
  NOTES="${2:-Atualização do app Fortuna.}"
else
  NOTES="${1:-Atualização do app Fortuna.}"
fi
echo "==> Publicando release"
gh release create "$TAG" "/tmp/$NAMED" \
  --title "Fortuna $VERSION_NAME (Android)" \
  --notes "$NOTES

Instale pelo Obtainium ou baixe o APK direto. Assinatura SHA-256: \`$FINGERPRINT\`."

rm -f "/tmp/$NAMED"
echo "==> Pronto: $(gh release view "$TAG" --json url --jq .url)"
