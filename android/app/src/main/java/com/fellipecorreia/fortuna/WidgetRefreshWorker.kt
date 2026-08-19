package com.fellipecorreia.fortuna

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters

/**
 * Busca o resumo e redesenha o widget.
 *
 * Fica num Worker, e não direto no `onUpdate`, por dois motivos: o
 * `onUpdate` roda na main thread (rede ali travaria a tela inicial) e é
 * disparado pelo sistema sem nenhuma garantia de conexão — foi assim que
 * apareceu o "Unable to resolve host" logo depois de instalar. Com o
 * WorkManager o trabalho espera a rede existir e tenta de novo sozinho.
 */
class WidgetRefreshWorker(context: Context, params: WorkerParameters) : Worker(context, params) {

    override fun doWork(): Result {
        val context = applicationContext

        return when (val result = FortunaApi.overview(context)) {
            is FortunaApi.Result.Ok -> {
                val data = result.value
                WidgetCache.save(
                    context = context,
                    monthLabel = data.monthLabel,
                    planned = OverviewWidget.money(data.plannedBalance),
                    current = context.getString(
                        R.string.widget_current,
                        OverviewWidget.money(data.currentBalance),
                    ),
                    goal = goalLine(context, data),
                    cards = data.cards.joinToString(" · ") {
                        "${it.name} ${OverviewWidget.money(it.total)}"
                    },
                )
                OverviewWidget.render(context, status = null)
                Result.success()
            }
            is FortunaApi.Result.Error -> {
                // Mantém o último valor conhecido na tela e explica embaixo.
                OverviewWidget.render(context, status = result.message)
                if (runAttemptCount < 3) Result.retry() else Result.success()
            }
        }
    }

    private fun goalLine(context: Context, data: FortunaApi.Overview): String {
        val remaining = data.goalRemaining ?: return context.getString(R.string.widget_goal_unset)
        return context.getString(
            R.string.widget_goal,
            OverviewWidget.money(remaining),
            OverviewWidget.money(data.goalPerDay ?: 0.0),
            data.goalDaysLeft ?: 0,
        )
    }

    companion object {
        private const val WORK_NAME = "fortuna-widget-refresh"

        fun enqueue(context: Context) {
            val request = OneTimeWorkRequestBuilder<WidgetRefreshWorker>()
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()
                )
                .build()

            WorkManager.getInstance(context)
                .enqueueUniqueWork(WORK_NAME, ExistingWorkPolicy.REPLACE, request)
        }

        fun hasWidgets(context: Context): Boolean =
            AppWidgetManager.getInstance(context)
                .getAppWidgetIds(ComponentName(context, OverviewWidget::class.java))
                .isNotEmpty()
    }
}
