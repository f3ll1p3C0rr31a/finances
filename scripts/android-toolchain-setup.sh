set -Eeuo pipefail
ROOT="$HOME/android-toolchain"
cd "$ROOT"

echo "==> JDK 17"
if [ ! -d jdk ]; then
  curl -fsSL -o jdk.tar.gz "https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse"
  mkdir -p jdk && tar xzf jdk.tar.gz -C jdk --strip-components=1 && rm jdk.tar.gz
fi
export JAVA_HOME="$ROOT/jdk"
export PATH="$JAVA_HOME/bin:$PATH"
java -version

echo "==> Gradle"
if [ ! -d gradle ]; then
  curl -fsSL -o gradle.zip "https://services.gradle.org/distributions/gradle-8.10.2-bin.zip"
  unzip -q gradle.zip && mv gradle-8.10.2 gradle && rm gradle.zip
fi

echo "==> Android command line tools"
if [ ! -d sdk/cmdline-tools/latest ]; then
  curl -fsSL -o cmdline.zip "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
  mkdir -p sdk/cmdline-tools && unzip -q cmdline.zip -d sdk/cmdline-tools
  mv sdk/cmdline-tools/cmdline-tools sdk/cmdline-tools/latest
  rm cmdline.zip
fi

export ANDROID_HOME="$ROOT/sdk"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

echo "==> Licencas e pacotes do SDK"
yes | sdkmanager --sdk_root="$ANDROID_HOME" --licenses > /dev/null 2>&1 || true
sdkmanager --sdk_root="$ANDROID_HOME" "platform-tools" "platforms;android-35" "build-tools;35.0.0" 2>&1 | tail -5

echo "==> Pronto"
du -sh "$ROOT"
