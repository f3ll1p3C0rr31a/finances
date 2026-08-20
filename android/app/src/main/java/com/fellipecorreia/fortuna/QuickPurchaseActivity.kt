package com.fellipecorreia.fortuna

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.button.MaterialButton
import com.google.android.material.chip.Chip
import com.google.android.material.chip.ChipGroup
import com.google.android.material.textfield.MaterialAutoCompleteTextView
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import java.util.concurrent.Executors

/**
 * Lançamento rápido de compra de cartão, aberto pelo toque no widget.
 *
 * A tela existe para o caso de uso de lançar no momento da compra, na fila do
 * caixa: valor, cartão, parcelas e etiquetas. Descrição é opcional — sem ela o
 * servidor grava "Compra rápida", que é melhor do que a compra não ser
 * lançada.
 *
 * Estende `AppCompatActivity` porque os componentes do Material 3 dependem do
 * inflater do AppCompat; num `Activity` puro eles nem sobem.
 */
class QuickPurchaseActivity : AppCompatActivity() {

    private val executor = Executors.newSingleThreadExecutor()
    private var cards: List<FortunaApi.Card> = emptyList()
    private var tags: List<FortunaApi.Tag> = emptyList()
    private val selectedTagIds = mutableSetOf<String>()
    private var selectedCard = 0

    private lateinit var amount: TextInputEditText
    private lateinit var amountLayout: TextInputLayout
    private lateinit var description: TextInputEditText
    private lateinit var installments: TextInputEditText
    private lateinit var cardField: MaterialAutoCompleteTextView
    private lateinit var modeField: MaterialAutoCompleteTextView
    private lateinit var tagGroup: ChipGroup
    private lateinit var tagsLabel: TextView
    private lateinit var save: MaterialButton
    private lateinit var progress: ProgressBar
    private lateinit var status: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (TokenStore.token(this) == null) {
            startActivity(Intent(this, SetupActivity::class.java))
            finish()
            return
        }

        setContentView(R.layout.activity_quick_purchase)
        amount = findViewById(R.id.amount)
        amountLayout = findViewById(R.id.amount_layout)
        description = findViewById(R.id.description)
        installments = findViewById(R.id.installments)
        cardField = findViewById(R.id.card)
        modeField = findViewById(R.id.mode)
        tagGroup = findViewById(R.id.tags)
        tagsLabel = findViewById(R.id.tags_label)
        save = findViewById(R.id.save)
        progress = findViewById(R.id.progress)
        status = findViewById(R.id.status)

        val modes = listOf(getString(R.string.mode_total), getString(R.string.mode_installment))
        modeField.setSimpleItems(modes.toTypedArray())
        modeField.setText(modes[0], false)

        findViewById<MaterialButton>(R.id.cancel).setOnClickListener { finish() }
        save.setOnClickListener { submit() }
        save.isEnabled = false

        load()
    }

    private fun load() {
        setBusy(true, getString(R.string.loading_cards))
        executor.execute {
            val result = FortunaApi.overview(this)
            runOnUiThread {
                when (result) {
                    is FortunaApi.Result.Ok -> {
                        cards = result.value.cards
                        tags = result.value.tags
                        if (cards.isEmpty()) {
                            setBusy(false, getString(R.string.no_cards))
                            return@runOnUiThread
                        }
                        fillCards()
                        fillTags()
                        setBusy(false, invoiceHint())
                        save.isEnabled = true
                    }
                    is FortunaApi.Result.Error -> setBusy(false, result.message)
                }
            }
        }
    }

    private fun fillCards() {
        cardField.setSimpleItems(
            cards.map { "${it.name} · ${OverviewWidget.money(it.total)}" }.toTypedArray()
        )
        cardField.setText(cardField.adapter.getItem(0).toString(), false)
        cardField.setOnItemClickListener { _, _, position, _ ->
            selectedCard = position
            // O ciclo de cada cartão é diferente, então a fatura de destino
            // muda conforme a escolha — vale mostrar antes de salvar.
            status.text = invoiceHint()
        }
    }

    private fun fillTags() {
        tagGroup.removeAllViews()
        if (tags.isEmpty()) {
            tagsLabel.visibility = View.GONE
            tagGroup.visibility = View.GONE
            return
        }
        for (tag in tags) {
            val chip = layoutInflater.inflate(R.layout.item_tag_chip, tagGroup, false) as Chip
            chip.text = tag.name
            chip.setOnCheckedChangeListener { _, checked ->
                if (checked) selectedTagIds.add(tag.id) else selectedTagIds.remove(tag.id)
            }
            tagGroup.addView(chip)
        }
    }

    private fun invoiceHint(): String =
        cards.getOrNull(selectedCard)?.let { getString(R.string.invoice_hint, it.invoiceLabel) } ?: ""

    private fun submit() {
        // Aceita "1.234,56" e "1234.56": o teclado numérico do Android varia
        // conforme o idioma e o fabricante.
        val typed = amount.text.toString().trim().replace(".", "").replace(',', '.')
        val value = typed.toDoubleOrNull()
        if (value == null || value <= 0) {
            amountLayout.error = getString(R.string.invalid_amount)
            return
        }
        amountLayout.error = null

        val card = cards.getOrNull(selectedCard) ?: return
        val parcelas = installments.text.toString().toIntOrNull() ?: 1
        val mode = if (modeField.text.toString() == getString(R.string.mode_installment)) {
            "INSTALLMENT"
        } else {
            "TOTAL"
        }
        val text = description.text.toString().trim()

        setBusy(true, getString(R.string.saving))
        executor.execute {
            val result = FortunaApi.createPurchase(
                context = this,
                cardId = card.id,
                description = text.ifBlank { getString(R.string.quick_purchase_default) },
                amount = value,
                installmentCount = parcelas.coerceIn(1, 48),
                amountMode = mode,
                tagIds = selectedTagIds.toList(),
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
