package com.fellipecorreia.fortuna

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.button.MaterialButton

/**
 * Colar o token gerado em Informações → Dispositivos, no site. É o único
 * passo de configuração do app.
 */
class SetupActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_setup)

        val token = findViewById<EditText>(R.id.token)
        val baseUrl = findViewById<EditText>(R.id.base_url)
        baseUrl.setText(TokenStore.baseUrl(this))

        findViewById<MaterialButton>(R.id.save).setOnClickListener {
            val value = token.text.toString().trim()
            if (value.isEmpty()) {
                Toast.makeText(this, R.string.token_required, Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            TokenStore.save(this, value, baseUrl.text.toString())
            OverviewWidget.requestRefresh(this)
            requestNotificationPermission()
            AgendaWorker.schedule(this)
            Toast.makeText(this, R.string.token_saved, Toast.LENGTH_SHORT).show()
            finish()
        }
    }

    /**
     * Sem a permissão o worker roda e não mostra nada, então vale pedir junto
     * com o token — é o único momento em que o usuário está configurando.
     */
    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
        ) {
            return
        }
        requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
    }
}
