package com.iot.simmanager.ussd

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.telephony.TelephonyManager
import androidx.core.app.ActivityCompat
import com.iot.simmanager.data.remote.models.UssdRequest
import com.iot.simmanager.domain.executor.UssdExecutor
import com.iot.simmanager.utils.AppLogger
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TelephonyUssdExecutor @Inject constructor(
    @ApplicationContext private val context: Context,
    private val logger: AppLogger
) : UssdExecutor {

    // Decodes the numeric failure codes from TelephonyManager — same as MBen's UssdBridge.java
    private fun decodeFailureCode(code: Int): String = when (code) {
        -1   -> "Menu response / Unknown error (carrier may require multi-step)"
        0    -> "No error"
        1    -> "Radio not available — device in flight mode or SIM missing"
        2    -> "Network timeout — carrier did not respond in time"
        3    -> "Network not allowed — carrier blocks USSD API on this device"
        4    -> "Invalid USSD format — check code syntax (e.g. *121#)"
        else -> "Unknown failure code: $code"
    }

    @SuppressLint("MissingPermission")
    override suspend fun execute(request: UssdRequest, callback: (String, String) -> Unit) {
        withContext(Dispatchers.Main) {
            // Permission check
            if (ActivityCompat.checkSelfPermission(context, Manifest.permission.CALL_PHONE)
                != PackageManager.PERMISSION_GRANTED) {
                val msg = "CALL_PHONE permission not granted"
                logger.e("TelephonyUSSD", msg)
                callback("error", msg)
                return@withContext
            }

            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                val msg = "Android 8.0+ required for silent USSD API"
                logger.e("TelephonyUSSD", msg)
                callback("error", msg)
                return@withContext
            }

            var telephonyManager = context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager

            // SIM slot selection using SubscriptionManager (same as MBen demo describes)
            if (request.simSlot != null) {
                if (ActivityCompat.checkSelfPermission(context, Manifest.permission.READ_PHONE_STATE)
                    == PackageManager.PERMISSION_GRANTED &&
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
                    try {
                        val subManager = context.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE)
                                as android.telephony.SubscriptionManager
                        val subInfo = subManager.activeSubscriptionInfoList
                            ?.find { it.simSlotIndex == request.simSlot }
                        if (subInfo != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                            telephonyManager = telephonyManager.createForSubscriptionId(subInfo.subscriptionId)
                            logger.d("TelephonyUSSD", "Locked to SIM slot ${request.simSlot} sub=${subInfo.subscriptionId}")
                        }
                    } catch (e: Exception) {
                        logger.e("TelephonyUSSD", "Failed to select SIM slot: ${e.message}")
                    }
                }
            }

            val handler = Handler(Looper.getMainLooper())
            logger.d("TelephonyUSSD", "Sending USSD: ${request.ussdCode} on sim=${request.simSlot}")

            try {
                telephonyManager.sendUssdRequest(
                    request.ussdCode,
                    object : TelephonyManager.UssdResponseCallback() {
                        override fun onReceiveUssdResponse(
                            tm: TelephonyManager?,
                            req: String?,
                            response: CharSequence?
                        ) {
                            val text = response?.toString() ?: "Empty response"
                            logger.d("TelephonyUSSD", "✅ USSD Success: $text")
                            callback("success", text)
                        }

                        override fun onReceiveUssdResponseFailed(
                            tm: TelephonyManager?,
                            req: String?,
                            failureCode: Int
                        ) {
                            val decoded = decodeFailureCode(failureCode)
                            logger.e("TelephonyUSSD", "❌ USSD Failed code=$failureCode → $decoded")
                            callback("failed", "Code $failureCode: $decoded")
                        }
                    },
                    handler
                )
            } catch (e: SecurityException) {
                val msg = "SecurityException: ${e.message} — CALL_PHONE may have been revoked"
                logger.e("TelephonyUSSD", msg)
                callback("error", msg)
            } catch (e: Exception) {
                val msg = "Exception: ${e.message}"
                logger.e("TelephonyUSSD", msg)
                callback("error", msg)
            }
        }
    }
}
