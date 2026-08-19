package com.fellipecorreia.fortuna

import android.content.Context

/**
 * Último resumo que chegou com sucesso.
 *
 * Sem isso, qualquer falha de rede apaga os números da tela inicial e deixa
 * um traço no lugar do saldo — pior do que mostrar o valor de meia hora atrás
 * avisando que está velho. O widget atualiza em janelas de 30 minutos e o
 * celular passa boa parte do tempo sem rede ativa, então falhar é rotina, não
 * exceção.
 */
object WidgetCache {
    private const val PREFS = "fortuna-widget"

    fun save(context: Context, monthLabel: String, planned: String, current: String, goal: String, cards: String) {
        prefs(context).edit()
            .putString("monthLabel", monthLabel)
            .putString("planned", planned)
            .putString("current", current)
            .putString("goal", goal)
            .putString("cards", cards)
            .putLong("updatedAt", System.currentTimeMillis())
            .apply()
    }

    fun monthLabel(context: Context): String? = prefs(context).getString("monthLabel", null)
    fun planned(context: Context): String = prefs(context).getString("planned", "—") ?: "—"
    fun current(context: Context): String = prefs(context).getString("current", "") ?: ""
    fun goal(context: Context): String = prefs(context).getString("goal", "") ?: ""
    fun cards(context: Context): String = prefs(context).getString("cards", "") ?: ""
    fun updatedAt(context: Context): Long = prefs(context).getLong("updatedAt", 0L)

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
