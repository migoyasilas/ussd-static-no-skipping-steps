package com.iot.simmanager.service

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.provider.Settings
import android.provider.Telephony
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.wifi.WifiManager
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import com.iot.simmanager.R
import android.app.PendingIntent
import com.google.gson.Gson
import com.iot.simmanager.accessibility.UssdAccessibilityService
import com.iot.simmanager.data.local.SettingsManager
import com.iot.simmanager.data.remote.WebSocketClient
import com.iot.simmanager.data.remote.models.UssdRequest
import com.iot.simmanager.data.remote.models.UssdResponse
import com.iot.simmanager.domain.repository.UssdRepository
import com.iot.simmanager.ui.UssdDialerActivity
import com.iot.simmanager.ussd.TelephonyUssdExecutor
import com.iot.simmanager.utils.AppLogger
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import javax.inject.Inject

@AndroidEntryPoint
class BackgroundUssdService : Service() {

    companion object {
        const val ACTION_STOP = "com.iot.simmanager.STOP_SERVICE"
        const val ACTION_START = "com.iot.simmanager.START_SERVICE"
    }

    @Inject lateinit var webSocketClient: WebSocketClient
    @Inject lateinit var settingsManager: SettingsManager
    @Inject lateinit var ussdRepository: UssdRepository
    @Inject lateinit var accessibilityStateManager: com.iot.simmanager.accessibility.AccessibilityStateManager
    @Inject lateinit var logger: AppLogger
    @Inject lateinit var gson: Gson

    // Exception handler that sends crashes TO the server instead of silently dropping them
    private val exceptionHandler = CoroutineExceptionHandler { _, throwable ->
        logger.e("Service", "💥 Coroutine crash: ${throwable.message}")
        webSocketClient.sendPayload(gson.toJson(mapOf(
            "type" to "SERVICE_ERROR",
            "error" to throwable.message,
            "trace" to throwable.stackTraceToString().take(500)
        )))
    }

    private val job = SupervisorJob()
    private val scope = CoroutineScope(Dispatchers.IO + job + exceptionHandler)

    /**
     * Ensures only ONE USSD executes at a time.
     * Concurrent executions caused interleaved dialers which produced ghost step inputs.
     * New requests queue up here and run sequentially.
     */
    private val ussdMutex = Mutex()
    private var cpuWakeLock: PowerManager.WakeLock? = null
    private var screenWakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null
    private var isNetworkCallbackRegistered = false

    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            super.onAvailable(network)
            logger.d("Service", "🌐 Network restored — triggering WebSocket recovery")
            scope.launch { webSocketClient.reconnectNow() }
        }
    }

    /** Tracks the main collection loop job — prevents duplicate loops on repeated onStartCommand calls */
    private var serviceJob: Job? = null

    override fun onCreate() {
        super.onCreate()
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager

        // PARTIAL_WAKE_LOCK — keeps CPU running when screen is off
        cpuWakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "IotSimManager::CpuWakeLock")
        cpuWakeLock?.acquire()

        val wm = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
        wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "IotSimManager::WifiLock")
        wifiLock?.acquire()

        val connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        connectivityManager.registerNetworkCallback(request, networkCallback)
        isNetworkCallbackRegistered = true

        startForeground(1, buildNotification())
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            logger.d("Service", "Stopping service via ACTION_STOP")
            webSocketClient.disconnect()
            // CRITICAL: Synchronous write before termination
            runBlocking { settingsManager.setServiceEnabled(false) }
            stopForeground(true)
            stopSelf()
            return START_NOT_STICKY
        }

        // CRITICAL: Guard against duplicate calls.
        if (serviceJob?.isActive == true) {
            logger.d("Service", "onStartCommand called but service already running — ignoring duplicate")
            return START_STICKY
        }

        serviceJob = scope.launch {
            val enabled = settingsManager.serviceEnabledFlow.first()
            if (!enabled) { stopSelf(); return@launch }

            val url  = settingsManager.backendUrlFlow.first()
            val token = settingsManager.authTokenFlow.first()

            logger.d("Service", "Connecting to $url")
            webSocketClient.connect(url, token)
            delay(2000) // Wait for socket handshake + connectionState to flip
            pushSimInfoToServer()
            pushSmsBox()

            // ── Log forwarding: mirror phone console to backend dashboard ──
            // AppLogger.onNewLog fires for every new entry. sendRaw avoids circular logging.
            logger.onNewLog = { entry ->
                webSocketClient.sendRaw(
                    gson.toJson(mapOf("type" to "DEVICE_LOG", "device" to "android", "message" to entry))
                )
            }

            // Send heartbeat immediately so we confirm outbound pipe works
            sendDirect("heartbeat", "Service started. WS connected=${webSocketClient.connectionState.value}. Watch for USSD requests...")

            // Start periodic heartbeat every 30s
            scope.launch {
                while (isActive) {
                    delay(30_000)
                    sendDirect("heartbeat", "alive — connected=${webSocketClient.connectionState.value}")
                }
            }

            logger.d("Service", "Collecting from requestsFlow...")

            webSocketClient.requestsFlow.collect { request ->
                logger.d("Service", "▶ Collected request: ${request.executionId} | ${request.ussdCode}")

                // ACK immediately so we know the request was received and outbound pipe works
                sendDirect("info", "✅ Request received: ${request.ussdCode} sim=${request.simSlot}", request.executionId)

                val tok = settingsManager.authTokenFlow.first()
                scope.launch(exceptionHandler) {
                    ussdMutex.withLock {
                        runFallbackChain(request, tok)
                    }
                }
            }
        }
        return START_STICKY
    }

    // ═══════════════════════════════════════════════════════════════
    //  3-TIER FALLBACK CHAIN
    // ═══════════════════════════════════════════════════════════════
    private suspend fun runFallbackChain(request: UssdRequest, token: String) {
        // TIER 1 (Silent API) has been removed as per user request.
        // We now go straight to launching the visible dialer.

        // Launch Tier 2 (visible dialer) via trampoline
        if (ActivityCompat.checkSelfPermission(this@BackgroundUssdService, Manifest.permission.CALL_PHONE)
            != PackageManager.PERMISSION_GRANTED) {
            send(request.executionId, "error", "CALL_PHONE permission denied", token)
            return
        }

        if (!isAccessibilityEnabled()) {
            send(request.executionId, "warning",
                "Accessibility Service NOT enabled. Multi-step USSD will likely fail. Please enable it in Settings.", token)
        }

        // Send 'info' to backend so user knows dialer is launching
        send(request.executionId, "info", "Waking screen and launching dialer in 2s...", token)

        // Force Screen ON for USSD display
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        @Suppress("DEPRECATION")
        val wl = pm.newWakeLock(
            PowerManager.SCREEN_BRIGHT_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
            "IotSimManager::DialerWakeup"
        )
        wl.acquire(5000) // Keep screen on for 5s while launching
        delay(2000) // Wait 2s for system stabilization as requested

        // Always clean up any previous USSD dialog/session before starting a new request.
        // This prevents a stale dialog from receiving steps belonging to the new request.
        withContext(Dispatchers.Main) {
            UssdAccessibilityService.instance?.closeCurrentDialogBeforeNewRequest()
        }
        delay(500)
        accessibilityStateManager.clearSession()
        accessibilityStateManager.startSession(request)

        val trampoline = Intent(this, UssdDialerActivity::class.java).apply {
            putExtra(UssdDialerActivity.EXTRA_USSD_CODE, request.ussdCode)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }

        try {
            withContext(Dispatchers.Main) { startActivity(trampoline) }
            
            // PRIORITY: 1. Payload Override -> 2. App Settings -> 3. Hardcoded Fallback
            val gracePeriod = request.gracePeriodMs ?: settingsManager.gracePeriodMsFlow.first()
            val cooldown    = request.stepCooldownMs ?: settingsManager.stepCooldownMsFlow.first()
            val tier2       = request.tier2TimeoutMs ?: settingsManager.tier2TimeoutMsFlow.first()
            
            send(request.executionId, "info",
                "TIER 2: Dialer launched — Grace=${gracePeriod}ms | StepCooldown=${cooldown}ms | Tier2Timeout=${tier2}ms", token)

            // ── PROACTIVE SCAN: fires exactly when grace period expires ──────────
            // Catches the case where the USSD dialog arrived during grace and is
            // now static — no new accessibility events will fire for it otherwise.
            delay(gracePeriod + 200L)
            withContext(Dispatchers.Main) {
                UssdAccessibilityService.instance?.triggerManualScan()
            }

            // Wait for the remainder of the Tier 2 timeout
            val remaining = tier2 - gracePeriod - 200L
            if (remaining > 0) delay(remaining)
        } catch (e: Exception) {
            send(request.executionId, "error", "TIER 2 launch failed: ${e.message}", token)
            return
        }

        // ── TIER 3: Timeout watchdog + force screen scan ───────────────
        if (accessibilityStateManager.currentRequest.value?.executionId == request.executionId) {
            send(request.executionId, "info", "TIER 3: Timeout — running force screen scan...", token)
            val a11y = UssdAccessibilityService.instance
            withContext(Dispatchers.Main) {
                if (a11y != null) {
                    a11y.forceCaptureFallback(request.executionId, token)
                } else {
                    scope.launch {
                        send(request.executionId, "failed",
                            "All 3 tiers failed. Accessibility Service is not running. Enable 'IoT USSD Scraper' in Accessibility settings.", token)
                        accessibilityStateManager.clearSession()
                    }
                }
            }
        }

    }

    // ─── Sending helpers ─────────────────────────────────────────────────

    /** Send directly via WebSocket (no Room, no REST — just raw send for speed) */
    private fun sendDirect(status: String, message: String, executionId: String = "svc_${System.currentTimeMillis()}") {
        val json = gson.toJson(UssdResponse(executionId, status, message))
        val sent = webSocketClient.sendPayload(json)
        logger.d("Service", "sendDirect [$status] sent=$sent: $message")
    }

    /** Full send via repository (saves to Room + WebSocket + REST fallback) */
    private suspend fun send(executionId: String, status: String, text: String, token: String) {
        logger.d("Service", "send [$status] $executionId: $text")
        try {
            ussdRepository.saveAndSendResult(executionId, status, text, token)
        } catch (e: Exception) {
            logger.e("Service", "saveAndSendResult failed: ${e.message} — trying direct WS")
            sendDirect(status, text, executionId)
        }
    }

    private fun isAccessibilityEnabled(): Boolean {
        val services = Settings.Secure.getString(
            contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES) ?: return false
        return services.contains(packageName, ignoreCase = true)
    }

    private fun pushSimInfoToServer() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_STATE)
            != PackageManager.PERMISSION_GRANTED) return
        try {
            val sims = mutableListOf<Map<String, Any>>()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
                val subMgr = getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE)
                        as android.telephony.SubscriptionManager
                subMgr.activeSubscriptionInfoList?.forEach { sub ->
                    sims.add(mapOf(
                        "slot" to sub.simSlotIndex,
                        "carrier" to (sub.carrierName?.toString() ?: "Unknown"),
                        "number" to (sub.number ?: "")
                    ))
                }
            }
            webSocketClient.sendPayload(gson.toJson(mapOf("type" to "DEVICE_INFO", "sims" to sims)))
            logger.d("Service", "SIM info pushed: $sims")
        } catch (e: Exception) {
            logger.e("Service", "SIM push failed: ${e.message}")
        }
    }

    private fun pushSmsBox() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.READ_SMS)
            != PackageManager.PERMISSION_GRANTED) return
        
        try {
            val cursor = contentResolver.query(
                Telephony.Sms.Inbox.CONTENT_URI,
                arrayOf(Telephony.Sms.Inbox.ADDRESS, Telephony.Sms.Inbox.BODY, Telephony.Sms.Inbox.DATE),
                null, null, "${Telephony.Sms.Inbox.DATE} DESC LIMIT 50"
            )

            cursor?.use {
                while (it.moveToNext()) {
                    val sender = it.getString(0)
                    val body = it.getString(1)
                    val ts = it.getLong(2)

                    val payload = mapOf(
                        "type" to "DEVICE_SMS",
                        "sender" to sender,
                        "body" to body,
                        "timestamp" to ts
                    )
                    webSocketClient.sendPayload(gson.toJson(payload))
                }
            }
            logger.d("Service", "Last 50 SMS history pushed to server")
        } catch (e: Exception) {
            logger.e("Service", "SMS push failed: ${e.message}")
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        job.cancel()
        webSocketClient.disconnect()
        
        try {
            if (isNetworkCallbackRegistered) {
                val connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
                connectivityManager.unregisterNetworkCallback(networkCallback)
            }
        } catch (e: Exception) {
            logger.e("Service", "NetworkCallback unregister failed: ${e.message}")
        }

        if (cpuWakeLock?.isHeld == true) cpuWakeLock?.release()
        if (screenWakeLock?.isHeld == true) screenWakeLock?.release()
        if (wifiLock?.isHeld == true) wifiLock?.release()
    }

    private fun buildNotification(): Notification {
        val ch = "ussd_bg_channel"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(ch, "USSD Service", NotificationManager.IMPORTANCE_HIGH)
            (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(channel)
        }

        val stopIntent = Intent(this, BackgroundUssdService::class.java).apply { action = ACTION_STOP }
        val stopPendingIntent = PendingIntent.getService(this, 0, stopIntent, 
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

        return NotificationCompat.Builder(this, ch)
            .setContentTitle("EPA Payment Engine Active")
            .setContentText("Listening for USSD commands...")
            .setSmallIcon(android.R.drawable.sym_def_app_icon)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "STOP ENGINE", stopPendingIntent)
            .setOngoing(true).build()
    }
}
