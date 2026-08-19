package com.fellipecorreia.fortuna

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import java.text.NumberFormat
import java.util.Locale
import java.util.concurrent.Executors

/**
 * Widget com o resumo do mês.
 *
 * O Android atualiza no máximo a cada 30 minutos (limite do sistema), então o
 * widget também traz um botão de atualizar. A busca sai da main thread porque
 * `onUpdate` roda nela e a rede a bloquearia.
 */
class OverviewWidget : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        manager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        refresh(context, manager, appWidgetIds)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_REFRESH) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, OverviewWidget::class.java))
            refresh(context, manager, ids)
        }
    }

    private fun refresh(context: Context, manager: AppWidgetManager, ids: IntArray) {
        if (ids.isEmpty()) return

        // Estado intermediário: sem isso o widget fica com o valor antigo na
        // tela enquanto a rede responde, e parece que o toque não funcionou.
        val loading = buildViews(context)
        loading.setTextViewText(R.id.widget_status, context.getString(R.string.widget_loading))
        ids.forEach { manager.updateAppWidget(it, loading) }

        executor.execute {
            val views = buildViews(context)
            when (val result = FortunaApi.overview(context)) {
                is FortunaApi.Result.Ok -> {
                    val data = result.value
                    views.setTextViewText(R.id.widget_month, data.monthLabel)
                    views.setTextViewText(R.id.widget_planned, money(data.plannedBalance))
                    views.setTextViewText(
                        R.id.widget_current,
                        context.getString(R.string.widget_current, money(data.currentBalance)),
                    )
                    views.setTextViewText(R.id.widget_goal, goalLine(context, data))
                    views.setTextViewText(R.id.widget_status, cardsLine(data))
                }
                is FortunaApi.Result.Error -> {
                    views.setTextViewText(R.id.widget_status, result.message)
                }
            }
            ids.forEach { manager.updateAppWidget(it, views) }
        }
    }

    private fun goalLine(context: Context, data: FortunaApi.Overview): String {
        val remaining = data.goalRemaining ?: return context.getString(R.string.widget_goal_unset)
        val perDay = data.goalPerDay ?: 0.0
        val days = data.goalDaysLeft ?: 0
        return context.getString(R.string.widget_goal, money(remaining), money(perDay), days)
    }

    private fun cardsLine(data: FortunaApi.Overview): String =
        data.cards.joinToString(" · ") { "${it.name} ${money(it.total)}" }

    private fun buildViews(context: Context): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_overview)

        // Corpo do widget abre o lançamento rápido; o ícone de atualizar
        // dispara o broadcast tratado acima.
        views.setOnClickPendingIntent(
            R.id.widget_root,
            PendingIntent.getActivity(
                context,
                0,
                Intent(context, QuickPurchaseActivity::class.java)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            ),
        )
        views.setOnClickPendingIntent(
            R.id.widget_refresh,
            PendingIntent.getBroadcast(
                context,
                1,
                Intent(context, OverviewWidget::class.java).setAction(ACTION_REFRESH),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            ),
        )
        return views
    }

    companion object {
        const val ACTION_REFRESH = "com.fellipecorreia.fortuna.REFRESH"

        private val executor = Executors.newSingleThreadExecutor()

        private val currency: NumberFormat =
            NumberFormat.getCurrencyInstance(Locale("pt", "BR"))

        fun money(value: Double): String = currency.format(value)

        /** Chamado depois de lançar uma compra, para o número não ficar velho. */
        fun requestRefresh(context: Context) {
            context.sendBroadcast(
                Intent(context, OverviewWidget::class.java).setAction(ACTION_REFRESH)
            )
        }
    }
}
