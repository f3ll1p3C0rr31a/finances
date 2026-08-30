package com.fellipecorreia.fortuna

import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.button.MaterialButton
import com.google.android.material.button.MaterialButtonToggleGroup
import com.google.android.material.chip.Chip
import com.google.android.material.chip.ChipGroup
import com.google.android.material.textfield.MaterialAutoCompleteTextView
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import java.text.NumberFormat
import java.util.Locale
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

    /** Valor digitado, em centavos — a máscara é a única fonte dele. */
    private var amountCents = 0L
    private var maskRunning = false
    private val money = NumberFormat.getNumberInstance(Locale("pt", "BR")).apply {
        minimumFractionDigits = 2
        maximumFractionDigits = 2
    }

    private lateinit var amount: TextInputEditText
    private lateinit var amountLayout: TextInputLayout
    private lateinit var description: TextInputEditText
    private lateinit var installments: TextInputEditText
    private lateinit var cardField: MaterialAutoCompleteTextView
    private lateinit var modeGroup: MaterialButtonToggleGroup
    private lateinit var preview: TextView
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
        modeGroup = findViewById(R.id.mode_group)
        preview = findViewById(R.id.preview)
        tagGroup = findViewById(R.id.tags)
        tagsLabel = findViewById(R.id.tags_label)
        save = findViewById(R.id.save)
        progress = findViewById(R.id.progress)
        status = findViewById(R.id.status)

        modeGroup.check(R.id.mode_total)
        modeGroup.addOnButtonCheckedListener { _, _, _ -> updatePreview() }
        installMoneyMask()
        installments.addTextChangedListener(afterChange { updatePreview() })

        findViewById<MaterialButton>(R.id.cancel).setOnClickListener { finish() }
        save.setOnClickListener { submit() }
        save.isEnabled = false

        load()
    }

    /**
     * Máscara de moeda: o campo aceita só dígitos e eles são lidos como
     * centavos — digitar 1000 mostra "10,00".
     *
     * `inputType="numberDecimal"` parecia o caminho óbvio, mas ele filtra o
     * separador decimal pelo locale do sistema, e o caractere que o teclado
     * emite costuma ser o outro. O resultado é não conseguir digitar centavos
     * de jeito nenhum. Com dígitos puros o problema deixa de existir.
     */
    private fun installMoneyMask() {
        amount.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) = Unit

            override fun afterTextChanged(editable: Editable) {
                if (maskRunning) return
                maskRunning = true

                val digits = editable.toString().filter { it.isDigit() }.take(11)
                amountCents = digits.toLongOrNull() ?: 0L
                val formatted = if (amountCents == 0L) "" else money.format(amountCents / 100.0)

                if (editable.toString() != formatted) {
                    amount.setText(formatted)
                    amount.setSelection(formatted.length)
                }

                maskRunning = false
                updatePreview()
            }
        })
    }

    private fun afterChange(action: () -> Unit) = object : TextWatcher {
        override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
        override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) = Unit
        override fun afterTextChanged(s: Editable?) = action()
    }

    private fun installmentCount(): Int =
        (installments.text.toString().toIntOrNull() ?: 1).coerceIn(1, 48)

    private fun isTotalMode(): Boolean = modeGroup.checkedButtonId != R.id.mode_installment

    /**
     * Mostra o que vai ser gravado. A divisão repete a do servidor: centavos
     * inteiros por parcela, com o resto na última — assim o número da tela é
     * o mesmo que aparece na fatura.
     */
    private fun updatePreview() {
        val card = cards.getOrNull(selectedCard)
        if (amountCents <= 0L || card == null) {
            preview.text = ""
            return
        }

        val parcelas = installmentCount()
        val totalCents = if (isTotalMode()) amountCents else amountCents * parcelas
        val parcelaCents = if (isTotalMode()) totalCents / parcelas else amountCents

        preview.text = if (parcelas > 1) {
            getString(
                R.string.preview_installments,
                parcelas,
                OverviewWidget.money(parcelaCents / 100.0),
                OverviewWidget.money(totalCents / 100.0),
                card.invoiceLabel,
            )
        } else {
            getString(
                R.string.preview_single,
                OverviewWidget.money(totalCents / 100.0),
                card.invoiceLabel,
            )
        }
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
                        updatePreview()
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
            updatePreview()
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
        // O valor vem da máscara, em centavos: nada de reinterpretar texto.
        if (amountCents <= 0L) {
            amountLayout.error = getString(R.string.invalid_amount)
            return
        }
        amountLayout.error = null

        val value = amountCents / 100.0
        val card = cards.getOrNull(selectedCard) ?: return
        val parcelas = installmentCount()
        val mode = if (isTotalMode()) "TOTAL" else "INSTALLMENT"
        val text = description.text.toString().trim()

        setBusy(true, getString(R.string.saving))
        executor.execute {
            val result = FortunaApi.createPurchase(
                context = this,
                cardId = card.id,
                description = text.ifBlank { getString(R.string.quick_purchase_default) },
                amount = value,
                installmentCount = parcelas,
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
