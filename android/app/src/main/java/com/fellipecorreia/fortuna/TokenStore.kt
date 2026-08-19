package com.fellipecorreia.fortuna

import android.content.Context

/**
 * Guarda o token de dispositivo gerado em Informações → Dispositivos.
 *
 * Fica em SharedPreferences privadas do app, que só o próprio app lê. Não é
 * cofre de hardware: o token dá acesso de leitura ao resumo do mês e permite
 * lançar compras, então revogue pelo site se perder o aparelho.
 */
object TokenStore {
    private const val PREFS = "fortuna"
    private const val KEY_TOKEN = "device_token"
    private const val KEY_BASE_URL = "base_url"

    const val DEFAULT_BASE_URL = "https://finances.fellipecorreia.com"

    fun token(context: Context): String? =
        prefs(context).getString(KEY_TOKEN, null)?.takeIf { it.isNotBlank() }

    fun baseUrl(context: Context): String =
        prefs(context).getString(KEY_BASE_URL, DEFAULT_BASE_URL) ?: DEFAULT_BASE_URL

    fun save(context: Context, token: String, baseUrl: String) {
        prefs(context).edit()
            .putString(KEY_TOKEN, token.trim())
            .putString(KEY_BASE_URL, baseUrl.trim().trimEnd('/'))
            .apply()
    }

    fun clear(context: Context) {
        prefs(context).edit().clear().apply()
    }

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
