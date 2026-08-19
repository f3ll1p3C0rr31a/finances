plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.fellipecorreia.fortuna"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.fellipecorreia.fortuna"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"

        // O host precisa bater com o assetlinks.json publicado pelo site,
        // senão o TWA abre com a barra de endereço do Chrome por cima.
        manifestPlaceholders["hostName"] = "finances.fellipecorreia.com"
        manifestPlaceholders["launchUrl"] = "/dashboard"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
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
}
