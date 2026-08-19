package com.fellipecorreia.fortuna

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.Calendar
import java.util.concurrent.TimeUnit

/**
 * Avisa uma vez por dia o que vence hoje e o que já venceu sem ser pago.
 *
 * Notificação local, não push: o aparelho pergunta ao servidor uma vez por
 * dia. Evita depender de Firebase para um app de um usuário só, e funciona sem
 * conta em serviço nenhum. O custo é a precisão — o aviso sai na janela do
 * agendamento, não no instante em que algo muda.
 */
class AgendaWorker(context: Context, params: WorkerParameters) : Worker(context, params) {

    override fun doWork(): Result {
        val context = applicationContext
        if (TokenStore.token(context) == null) return Result.success()

        return when (val result = FortunaApi.agenda(context)) {
            is FortunaApi.Result.Error -> Result.retry()
            is FortunaApi.Result.Ok -> {
                notify(context, result.value)
                Result.success()
            }
        }
    }

    private fun notify(context: Context, items: List<FortunaApi.AgendaItem>) {
        if (items.isEmpty()) return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            return
        }

        ensureChannel(context)
        val manager = NotificationManagerCompat.from(context)

        val open = PendingIntent.getActivity(
            context,
            0,
            Intent(Intent.ACTION_VIEW, Uri.parse("${TokenStore.baseUrl(context)}/dashboard")),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        // Uma notificação por item, agrupadas: assim dá para dispensar as que
        // já foram resolvidas sem perder as outras.
        items.forEachIndexed { index, item ->
            val prefix = when {
                item.overdue -> context.getString(R.string.notif_overdue)
                item.kind == "income" -> context.getString(R.string.notif_income)
                else -> context.getString(R.string.notif_today)
            }
            val suffix = if (item.thirdParty) context.getString(R.string.notif_third_party) else ""

            manager.notify(
                NOTIFICATION_BASE_ID + index,
                NotificationCompat.Builder(context, CHANNEL_ID)
                    .setSmallIcon(R.drawable.ic_notification)
                    .setContentTitle("$prefix ${item.title}$suffix")
                    .setContentText(OverviewWidget.money(item.amount))
                    .setGroup(GROUP)
                    .setAutoCancel(true)
                    .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                    .setContentIntent(open)
                    .build(),
            )
        }

        manager.notify(
            NOTIFICATION_BASE_ID - 1,
            NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(context.getString(R.string.notif_summary_title, items.size))
                .setGroup(GROUP)
                .setGroupSummary(true)
                .setAutoCancel(true)
                .setContentIntent(open)
                .build(),
        )
    }

    private fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            context.getString(R.string.notif_channel),
            NotificationManager.IMPORTANCE_DEFAULT,
        ).apply {
            description = context.getString(R.string.notif_channel_description)
        }
        context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    companion object {
        private const val CHANNEL_ID = "fortuna-agenda"
        private const val GROUP = "fortuna-agenda-group"
        private const val NOTIFICATION_BASE_ID = 1000
        private const val WORK_NAME = "fortuna-agenda-daily"

        /** Hora do aviso: cedo o bastante para dar tempo de pagar no mesmo dia. */
        private const val HOUR_OF_DAY = 8

        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<AgendaWorker>(1, TimeUnit.DAYS)
                .setInitialDelay(delayUntilNextRun(), TimeUnit.MILLISECONDS)
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()
                )
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.UPDATE,
                request,
            )
        }

        private fun delayUntilNextRun(): Long {
            val now = Calendar.getInstance()
            val next = (now.clone() as Calendar).apply {
                set(Calendar.HOUR_OF_DAY, HOUR_OF_DAY)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
                if (before(now)) add(Calendar.DAY_OF_YEAR, 1)
            }
            return next.timeInMillis - now.timeInMillis
        }
    }
}
