package com.fellipecorreia.fortuna

import android.content.Context
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.SocketTimeoutException
import java.net.URL
import java.net.UnknownHostException

/**
 * Cliente das rotas sob `/api/widget`.
 *
 * HttpURLConnection e org.json em vez de OkHttp/Retrofit de propósito: são
 * duas chamadas, e menos dependência é menos coisa para quebrar num app que
 * vai ficar anos sem receber manutenção.
 *
 * Todas as chamadas são bloqueantes — quem chama já está fora da main thread.
 */
object FortunaApi {

    sealed interface Result<out T> {
        data class Ok<T>(val value: T) : Result<T>
        data class Error(val message: String) : Result<Nothing>
    }

    data class Card(val id: String, val name: String, val total: Double, val invoiceLabel: String)

    data class AgendaItem(
        val kind: String,
        val title: String,
        val amount: Double,
        val overdue: Boolean,
        val thirdParty: Boolean,
    )

    data class Overview(
        val monthLabel: String,
        val plannedBalance: Double,
        val currentBalance: Double,
        val goal: Double?,
        val goalMonthLabel: String,
        val goalProjected: Double,
        val goalRemaining: Double?,
        val goalPerDay: Double?,
        val goalDaysLeft: Int?,
        val cards: List<Card>,
        val tags: List<Tag>,
    )

    data class Tag(val id: String, val name: String)

    fun overview(context: Context): Result<Overview> {
        val token = TokenStore.token(context)
            ?: return Result.Error(context.getString(R.string.error_no_token))

        // `when` direto em vez de runCatching: este arquivo declara o proprio
        // `Result`, que sombreia o `kotlin.Result` devolvido por runCatching e
        // atrapalha a inferencia.
        return when (val result = request(
            url = "${TokenStore.baseUrl(context)}/api/widget/overview",
            token = token,
            method = "GET",
            body = null,
        )) {
            is Result.Error -> result
            is Result.Ok -> try {
                Result.Ok(parseOverview(result.value))
            } catch (error: Exception) {
                Result.Error(context.getString(R.string.error_unexpected_response))
            }
        }
    }

    fun agenda(context: Context): Result<List<AgendaItem>> {
        val token = TokenStore.token(context)
            ?: return Result.Error(context.getString(R.string.error_no_token))

        return when (val result = request(
            url = "${TokenStore.baseUrl(context)}/api/widget/agenda",
            token = token,
            method = "GET",
            body = null,
        )) {
            is Result.Error -> result
            is Result.Ok -> {
                val array = result.value.optJSONArray("items")
                val items = buildList {
                    for (i in 0 until (array?.length() ?: 0)) {
                        val item = array!!.getJSONObject(i)
                        add(
                            AgendaItem(
                                kind = item.optString("kind"),
                                title = item.optString("title"),
                                amount = item.optDouble("amount", 0.0),
                                overdue = item.optBoolean("overdue"),
                                thirdParty = item.optBoolean("thirdParty"),
                            )
                        )
                    }
                }
                Result.Ok(items)
            }
        }
    }

    fun createPurchase(
        context: Context,
        cardId: String,
        description: String,
        amount: Double,
        installmentCount: Int,
        amountMode: String,
        tagIds: List<String>,
    ): Result<String> {
        val token = TokenStore.token(context)
            ?: return Result.Error(context.getString(R.string.error_no_token))

        val payload = JSONObject().apply {
            put("cardId", cardId)
            put("description", description)
            put("amount", amount)
            put("installmentCount", installmentCount)
            put("amountMode", amountMode)
            put("hasInterest", false)
            put("tagIds", org.json.JSONArray(tagIds))
        }

        return when (val result = request(
            url = "${TokenStore.baseUrl(context)}/api/widget/purchase",
            token = token,
            method = "POST",
            body = payload.toString(),
        )) {
            is Result.Error -> result
            is Result.Ok -> Result.Ok(
                result.value.optString("billingMonthLabel").ifBlank { "—" }
            )
        }
    }

    private fun parseOverview(json: JSONObject): Overview {
        val goal = json.optJSONObject("cardGoal")
        val cardsJson = json.optJSONArray("cards")
        val cards = buildList {
            for (i in 0 until (cardsJson?.length() ?: 0)) {
                val card = cardsJson!!.getJSONObject(i)
                add(
                    Card(
                        id = card.getString("id"),
                        name = card.getString("name"),
                        total = card.optDouble("total", 0.0),
                        invoiceLabel = card.optString("invoiceMonthLabel"),
                    )
                )
            }
        }

        val tagsJson = json.optJSONArray("tags")
        val tags = buildList {
            for (i in 0 until (tagsJson?.length() ?: 0)) {
                val tag = tagsJson!!.getJSONObject(i)
                add(Tag(id = tag.getString("id"), name = tag.getString("name")))
            }
        }

        return Overview(
            monthLabel = json.optString("monthLabel"),
            plannedBalance = json.optDouble("plannedBalance", 0.0),
            currentBalance = json.optDouble("currentBalance", 0.0),
            // `goal` vem nulo quando não há meta cadastrada; sem ela não há
            // barra de progresso a desenhar.
            goal = if (goal?.isNull("goal") == false) goal.optDouble("goal") else null,
            goalMonthLabel = goal?.optString("monthLabel").orEmpty(),
            goalProjected = goal?.optDouble("projectedSpent", 0.0) ?: 0.0,
            goalRemaining = goal?.optDouble("remaining"),
            goalPerDay = goal?.optDouble("perDay"),
            goalDaysLeft = goal?.optInt("daysLeft"),
            cards = cards,
            tags = tags,
        )
    }

    private fun request(
        url: String,
        token: String,
        method: String,
        body: String?,
    ): Result<JSONObject> {
        val connection = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            setRequestProperty("Authorization", "Bearer $token")
            setRequestProperty("Accept", "application/json")
            connectTimeout = 15_000
            readTimeout = 15_000
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
            }
        }

        return try {
            if (body != null) {
                connection.outputStream.use { it.write(body.toByteArray()) }
            }
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()

            when {
                code == 401 -> Result.Error("Token inválido ou revogado")
                code !in 200..299 -> Result.Error(errorMessage(text, code))
                else -> Result.Ok(JSONObject(text))
            }
        } catch (error: Exception) {
            // "Unable to resolve host ..." nao diz nada a quem esta olhando a
            // tela inicial; o que importa e que faltou rede naquele momento.
            Result.Error(
                when (error) {
                    is UnknownHostException -> "Sem conexão"
                    is SocketTimeoutException -> "Servidor não respondeu"
                    is IOException -> "Falha de rede"
                    else -> error.message ?: "Falha de rede"
                }
            )
        } finally {
            connection.disconnect()
        }
    }

    private fun errorMessage(text: String, code: Int): String =
        try {
            JSONObject(text).optString("error").ifBlank { "HTTP $code" }
        } catch (error: Exception) {
            "HTTP $code"
        }
}
