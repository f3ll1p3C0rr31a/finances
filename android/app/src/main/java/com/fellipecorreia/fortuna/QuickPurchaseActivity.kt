package com.fellipecorreia.fortuna

import android.app.Activity
import android.os.Bundle
import android.view.View
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.ProgressBar
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import java.util.concurrent.Executors

/**
 * Lançamento rápido de compra de cartão, aberto pelo toque no widget.
 *
 * A tela existe para o caso de uso de lançar no momento da compra, na fila do
 * caixa: valor, cartão e parcelas, nada mais. Descrição é opcional — sem ela o
 * servidor grava "Compra rápida", que é melhor do que a compra não ser
 * lançada.
 */
class QuickPurchaseActivity : Activity() {

    private val executor = Executors.newSingleThreadExecutor()
    private var cards: List<FortunaApi.Card> = emptyList()

    private lateinit var amount: EditText
    private lateinit var description: EditText
    private lateinit var installments: EditText
    private lateinit var cardSpinner: Spinner
    private lateinit var modeSpinner: Spinner
    private lateinit var save: Button
    private lateinit var progress: ProgressBar
    private lateinit var status: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (TokenStore.token(this) == null) {
            startActivity(android.content.Intent(this, SetupActivity::class.java))
            finish()
            return
        }

        setContentView(R.layout.activity_quick_purchase)
        amount = findViewById(R.id.amount)
        description = findViewById(R.id.description)
        installments = findViewById(R.id.installments)
        cardSpinner = findViewById(R.id.card)
        modeSpinner = findViewById(R.id.mode)
        save = findViewById(R.id.save)
        progress = findViewById(R.id.progress)
        status = findViewById(R.id.status)

        modeSpinner.adapter = ArrayAdapter(
            this,
            android.R.layout.simple_spinner_dropdown_item,
            listOf(getString(R.string.mode_total), getString(R.string.mode_installment)),
        )

        findViewById<Button>(R.id.cancel).setOnClickListener { finish() }
        save.setOnClickListener { submit() }
        save.isEnabled = false

        loadCards()
    }

    private fun loadCards() {
        setBusy(true, getString(R.string.loading_cards))
        executor.execute {
            val result = FortunaApi.overview(this)
            runOnUiThread {
                when (result) {
                    is FortunaApi.Result.Ok -> {
                        cards = result.value.cards
                        if (cards.isEmpty()) {
                            setBusy(false, getString(R.string.no_cards))
                            return@runOnUiThread
                        }
                        cardSpinner.adapter = ArrayAdapter(
                            this,
                            android.R.layout.simple_spinner_dropdown_item,
                            cards.map { "${it.name} · ${OverviewWidget.money(it.total)}" },
                        )
                        cardSpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                            override fun onItemSelected(p: AdapterView<*>?, v: View?, position: Int, id: Long) {
                                status.text = getString(R.string.invoice_hint, cards[position].invoiceLabel)
                            }

                            override fun onNothingSelected(p: AdapterView<*>?) = Unit
                        }
                        setBusy(false, "")
                        save.isEnabled = true
                    }
                    is FortunaApi.Result.Error -> setBusy(false, result.message)
                }
            }
        }
    }

    private fun submit() {
        val value = amount.text.toString().replace(".", "").replace(',', '.').toDoubleOrNull()
        if (value == null || value <= 0) {
            status.text = getString(R.string.invalid_amount)
            return
        }
        val position = cardSpinner.selectedItemPosition
        if (position !in cards.indices) return

        val parcelas = installments.text.toString().toIntOrNull() ?: 1
        val mode = if (modeSpinner.selectedItemPosition == 1) "INSTALLMENT" else "TOTAL"
        val text = description.text.toString().trim()

        setBusy(true, getString(R.string.saving))
        executor.execute {
            val result = FortunaApi.createPurchase(
                context = this,
                cardId = cards[position].id,
                description = text.ifBlank { getString(R.string.quick_purchase_default) },
                amount = value,
                installmentCount = parcelas.coerceIn(1, 48),
                amountMode = mode,
            )
            runOnUiThread {
                when (result) {
                    is FortunaApi.Result.Ok -> {
                        Toast.makeText(
                            this,
                            getString(R.string.saved_on_invoice, result.value),
                            Toast.LENGTH_LONG,
                        ).show()
                        OverviewWidget.requestRefresh(this)
                        finish()
                    }
                    is FortunaApi.Result.Error -> setBusy(false, result.message)
                }
            }
        }
    }

    private fun setBusy(busy: Boolean, message: String) {
        progress.visibility = if (busy) View.VISIBLE else View.GONE
        save.isEnabled = !busy && cards.isNotEmpty()
        status.text = message
    }
}
