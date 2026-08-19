package com.fellipecorreia.fortuna

import android.app.Activity
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.Toast

/**
 * Colar o token gerado em Informações → Dispositivos, no site. É o único
 * passo de configuração do app.
 */
class SetupActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_setup)

        val token = findViewById<EditText>(R.id.token)
        val baseUrl = findViewById<EditText>(R.id.base_url)
        baseUrl.setText(TokenStore.baseUrl(this))

        findViewById<Button>(R.id.save).setOnClickListener {
            val value = token.text.toString().trim()
            if (value.isEmpty()) {
                Toast.makeText(this, R.string.token_required, Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            TokenStore.save(this, value, baseUrl.text.toString())
            OverviewWidget.requestRefresh(this)
            Toast.makeText(this, R.string.token_saved, Toast.LENGTH_SHORT).show()
            finish()
        }
    }
}
