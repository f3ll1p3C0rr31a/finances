import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Credenciais da chave de assinatura ficam fora do versionamento; sem o
// arquivo, o build de release sai sem assinatura (útil em CI, inútil para
// instalar no aparelho).
val keystoreProperties = Properties().apply {
    val file = rootProject.file("keystore.properties")
    if (file.exists()) file.inputStream().use { load(it) }
}

android {
    namespace = "com.fellipecorreia.fortuna"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.fellipecorreia.fortuna"
        minSdk = 26
        targetSdk = 35
        versionCode = 2
        versionName = "1.1"

        // O host precisa bater com o assetlinks.json publicado pelo site,
        // senão o TWA abre com a barra de endereço do Chrome por cima.
        manifestPlaceholders["hostName"] = "finances.fellipecorreia.com"
        manifestPlaceholders["launchUrl"] = "/dashboard"
    }

    signingConfigs {
        if (keystoreProperties.getProperty("storeFile") != null) {
            create("release") {
                storeFile = rootProject.file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    // TWA: abre o site em tela cheia, sem barra do navegador, usando o Chrome
    // instalado. É o que transforma o PWA em app sem reescrever nada.
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.5.0")
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    // Agendamento do aviso diário: sobrevive a reboot e respeita a economia
    // de bateria, coisas que um AlarmManager cru teria que resolver na mão.
    implementation("androidx.work:work-runtime-ktx:2.9.1")
}
