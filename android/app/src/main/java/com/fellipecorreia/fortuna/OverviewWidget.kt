package com.fellipecorreia.fortuna

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews
import java.text.NumberFormat
import java.util.Locale

/**
 * Widget com o resumo do mês.
 *
 * Aqui só se desenha: quem busca os dados é o [WidgetRefreshWorker], porque
 * `onUpdate` roda na main thread e é disparado sem garantia de rede. O widget
 * pinta sempre a partir do [WidgetCache], então uma falha de conexão mantém os
 * últimos números na tela em vez de apagá-los.
 *
 * O Android atualiza no máximo a cada 30 minutos; o botão de refresh existe
 * para quando você quiser o número na hora.
 */
class OverviewWidget : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, appWidgetIds: IntArray) {
        render(context, status = context.getString(R.string.widget_loading))
        WidgetRefreshWorker.enqueue(context)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_REFRESH) {
            render(context, status = context.getString(R.string.widget_loading))
            WidgetRefreshWorker.enqueue(context)
        }
    }

    companion object {
        const val ACTION_REFRESH = "com.fellipecorreia.fortuna.REFRESH"

        private val currency: NumberFormat = NumberFormat.getCurrencyInstance(Locale("pt", "BR"))

        fun money(value: Double): String = currency.format(value)

        /**
         * Redesenha todos os widgets a partir do cache. `status` sobrescreve a
         * linha de baixo (carregando, erro); nulo mostra as faturas.
         */
        fun render(context: Context, status: String?) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, OverviewWidget::class.java))
            if (ids.isEmpty()) return

            val views = RemoteViews(context.packageName, R.layout.widget_overview)
            views.setTextViewText(
                R.id.widget_month,
                WidgetCache.monthLabel(context) ?: context.getString(R.string.app_name),
            )
            views.setTextViewText(R.id.widget_planned, WidgetCache.planned(context))
            views.setTextViewText(R.id.widget_current, WidgetCache.current(context))
            views.setTextViewText(R.id.widget_goal, WidgetCache.goal(context))

            // Barra da meta: a roxa mostra o quanto já foi; quando estoura,
            // some e dá lugar à vermelha cheia. Sem meta cadastrada, nenhuma
            // das duas aparece.
            val hasGoal = WidgetCache.hasGoal(context)
            val over = WidgetCache.goalOver(context)
            views.setViewVisibility(
                R.id.widget_goal_bar,
                if (hasGoal && !over) View.VISIBLE else View.GONE,
            )
            views.setViewVisibility(
                R.id.widget_goal_bar_over,
                if (hasGoal && over) View.VISIBLE else View.GONE,
            )
            if (hasGoal && !over) {
                views.setProgressBar(R.id.widget_goal_bar, 100, WidgetCache.goalPercent(context), false)
            }
            views.setTextViewText(R.id.widget_status, status ?: WidgetCache.cards(context))

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

            ids.forEach { manager.updateAppWidget(it, views) }
        }

        /** Chamado depois de lançar uma compra, para o número não ficar velho. */
        fun requestRefresh(context: Context) {
            context.sendBroadcast(
                Intent(context, OverviewWidget::class.java).setAction(ACTION_REFRESH)
            )
        }
    }
}
