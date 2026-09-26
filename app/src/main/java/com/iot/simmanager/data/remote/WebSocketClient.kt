package com.iot.simmanager.data.remote

import android.util.Log
import com.google.gson.Gson
import com.iot.simmanager.data.remote.models.UssdRequest
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.*
import okhttp3.*
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class WebSocketClient @Inject constructor(
    private val client: OkHttpClient,
    private val gson: Gson,
    private val logger: com.iot.simmanager.utils.AppLogger
) {
    private var webSocket: WebSocket? = null
    private var lastUrl: String? = null
    private var lastToken: String? = null
    private var isDisconnectionIntentional = false
    private var reconnectAttempt = 0
    private val scope = kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.SupervisorJob() + kotlinx.coroutines.Dispatchers.IO)

    /**
     * Buffer of 64 — messages are stored even if nobody is collecting yet.
     * MutableSharedFlow() with default 0 buffer silently drops messages via tryEmit().
     */
    private val _requestsFlow = MutableSharedFlow<UssdRequest>(extraBufferCapacity = 64)
    val requestsFlow: SharedFlow<UssdRequest> = _requestsFlow.asSharedFlow()

    private val _connectionState = MutableStateFlow(false)
    val connectionState = _connectionState.asStateFlow()

    fun connect(url: String, token: String) {
        lastUrl = url
        lastToken = token
        isDisconnectionIntentional = false
        
        val request = Request.Builder()
            .url(url)
            .addHeader("Authorization", "Bearer $token")
            .build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                logger.d("WS", "✅ Connected to $url")
                _connectionState.value = true
                reconnectAttempt = 0
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                logger.d("WS", "📥 Raw message: $text")

                try {
                    val map = gson.fromJson(text, Map::class.java)

                    // Only parse as UssdRequest if it has an execution_id field
                    // This prevents DEVICE_STATUS / DEVICE_SIMS / etc from being parsed
                    // as a garbage UssdRequest with null fields
                    if (map.containsKey("execution_id") && map.containsKey("ussd_code")) {
                        val req = gson.fromJson(text, UssdRequest::class.java)
                        val emitted = _requestsFlow.tryEmit(req)
                        if (!emitted) {
                            logger.e("WS", "⚠️ requestsFlow buffer full — request dropped!")
                        } else {
                            logger.d("WS", "✅ Emitted request ${req.executionId} to flow")
                        }
                    } else {
                        logger.d("WS", "Ignored non-USSD message (type=${map["type"] ?: "unknown"})")
                    }
                } catch (e: Exception) {
                    logger.e("WS", "Parse error: ${e.message}")
                }
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                logger.d("WS", "Closed: $reason")
                _connectionState.value = false
                if (!isDisconnectionIntentional) triggerReconnect()
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                logger.e("WS", "❌ Connection failed: ${t.message}")
                _connectionState.value = false
                if (!isDisconnectionIntentional) triggerReconnect()
            }
        })
    }

    private fun triggerReconnect() {
        val url = lastUrl ?: return
        val token = lastToken ?: return

        reconnectAttempt++
        val backoff = when (reconnectAttempt) {
            1 -> 2000L
            2 -> 4000L
            3 -> 8000L
            4 -> 16000L
            else -> 30000L
        }

        logger.d("WS", "🔄 Reconnecting in ${backoff/1000}s... (Attempt $reconnectAttempt)")
        
        scope.launch {
            kotlinx.coroutines.delay(backoff)
            if (!connectionState.value && !isDisconnectionIntentional) {
                connect(url, token)
            }
        }
    }

    fun disconnect() {
        isDisconnectionIntentional = true
        logger.d("WS", "Disconnecting intentionally — auto-reconnect DISABLED")
        webSocket?.close(1000, "Service stopped")
        webSocket = null
        _connectionState.value = false
    }

    /**
     * Instantly triggers a reconnection attempt if not already connected.
     * Bypasses the exponential backoff timer.
     */
    fun reconnectNow() {
        val url = lastUrl ?: return
        val token = lastToken ?: return
        if (!connectionState.value && !isDisconnectionIntentional) {
            logger.d("WS", "⚡ Manual reconnect triggered by connectivity monitor")
            connect(url, token)
        }
    }

    fun sendPayload(json: String): Boolean {
        return if (_connectionState.value && webSocket != null) {
            val sent = webSocket?.send(json) ?: false
            if (sent) logger.d("WS", "📤 Sent: $json")
            else logger.e("WS", "📤 SEND FAILED (buffer full?): $json")
            sent
        } else {
            logger.e("WS", "📤 Cannot send — not connected. json=$json")
            false
        }
    }

    /**
     * Silent send — does NOT call logger.d/e so it cannot create log entries.
     * Used exclusively for forwarding AppLogger entries to the backend to
     * prevent circular: log → sendRaw → log → sendRaw → ...
     */
    fun sendRaw(json: String) {
        if (_connectionState.value) webSocket?.send(json)
    }
}
