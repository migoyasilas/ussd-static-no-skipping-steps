package com.iot.simmanager.accessibility

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.os.Bundle
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.iot.simmanager.data.local.SettingsManager
import com.iot.simmanager.domain.repository.UssdRepository
import com.iot.simmanager.utils.AppLogger
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import javax.inject.Inject

@AndroidEntryPoint
class UssdAccessibilityService : AccessibilityService() {

    @Inject lateinit var stateManager: AccessibilityStateManager
    @Inject lateinit var repository: UssdRepository
    @Inject lateinit var settingsManager: SettingsManager
    @Inject lateinit var logger: AppLogger

    private val job = SupervisorJob()
    private val scope = CoroutineScope(Dispatchers.IO + job)

    // Dedup: ignore repeated dialogs with the same text within 3 seconds
    private var lastProcessedText = ""
    private var lastProcessedTime = 0L

    // Step cooldown: after entering a step, ignore events for 2s to let UI settle
    private var stepCooldownUntil = 0L

    // Known carrier/OEM dialer packages that host USSD response dialogs
    private val ussdPackages = setOf(
        "com.android.phone",
        "com.android.dialer",
        "com.samsung.android.dialer",
        "com.samsung.android.incallui",
        "com.google.android.dialer",
        "com.android.incallui",
        "com.huawei.phone",
        "com.motorola.incallui",
        "com.oneplus.dialer",
        "com.coloros.phone"
    )

    /**
     * Loading phrases loaded from SettingsManager at runtime.
     * Edit them in the app's Timing tab without recompiling.
     */
    private var loadingScreenPhrases: List<String> = listOf(
        "Running USSD code", "Please wait", "Connecting", "Dialing", "Processing"
    )

    private fun reloadLoadingPhrases() {
        scope.launch {
            settingsManager.loadingPhrasesFlow.collect { raw ->
                loadingScreenPhrases = raw.split(",").map { it.trim() }.filter { it.isNotEmpty() }
            }
        }
    }

    /**
     * Phrases that mean the carrier REJECTED our input (wrong selection, bad session, etc).
     * When detected, we immediately dismiss the dialog and send a 'failed' status instead of
     * trying to enter more steps — there is no recoverable session at this point.
     */
    private val errorDialogPhrases = listOf(
        "entered menu number is incorrect",
        "invalid input",
        "invalid selection",
        "invalid option",
        "incorrect option",
        "wrong input",
        "invalid entry",
        "service not available",
        "session expired",
        "request failed"
    )

    private fun isErrorDialog(text: String): Boolean {
        val lower = text.lowercase()
        return errorDialogPhrases.any { lower.contains(it) }
    }

    companion object {
        var instance: UssdAccessibilityService? = null
    }

    override fun onServiceConnected() {
        instance = this
        reloadLoadingPhrases()
        logger.d("A11y", "✅ Accessibility Service connected")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED &&
            event.eventType != AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED) return

        val pkg = event.packageName?.toString() ?: return
        if (pkg !in ussdPackages) return

        // ── STEP COOLDOWN ──────────────────────────────────────────────
        // After we send a step, ignore all events for 2 seconds to let the
        // carrier's USSD dialog settle into its next state. Without this,
        // the same step gets entered multiple times on duplicate events.
        val now = SystemClock.elapsedRealtime()
        if (now < stepCooldownUntil) {
            logger.d("A11y", "Cooldown active — ignoring event from $pkg")
            return
        }

        val root = rootInActiveWindow ?: return
        try {
            processWindow(root, pkg, now)
        } finally {
            root.recycle()
        }
    }

    private fun processWindow(root: AccessibilityNodeInfo, pkg: String, now: Long) {
        val allText = extractAllText(root).trim()
        if (allText.isBlank()) return

        // ── LOADING SCREEN FILTER ──────────────────────────────────────
        // Carriers like bKash show "Running USSD code… / Loading" while connecting.
        // Capturing this as a response would clear the session before the real menu appears.
        if (isLoadingScreen(allText)) {
            logger.d("A11y", "Skipping loading screen: ${allText.take(40)}")
            return
        }

        val activeRequest = stateManager.currentRequest.value ?: return

        // ── REAL USSD-DIALOG GATE ──────────────────────────────────────
        // A phone/dialer package can also contain the ordinary in-call UI.
        // Never treat that UI as a USSD menu and never type a step into it.
        // We require an actual dialog/menu signal before any step can be entered.
        if (!isLikelyUssdDialog(root, allText)) {
            logger.d("A11y", "Ignoring phone UI that does not look like a USSD dialog: ${allText.take(60)}")
            return
        }

        // ── TEXT DEDUP ─────────────────────────────────────────────────
        if (allText == lastProcessedText && now - lastProcessedTime < 3000) return

        // ── LIVE REPORTING ─────────────────────────────────────────────
        // Send every captured USSD menu/response to the backend immediately.
        // This ensures the dashboard sees the intermediate steps live.
        scope.launch {
            val token = settingsManager.authTokenFlow.first()
            repository.saveAndSendResult(
                activeRequest.executionId, "live_menu", allText, token
            )
        }

        // ── IN-FLIGHT GUARD ────────────────────────────────────────────
        if (stateManager.stepInFlight) {
            logger.d("A11y", "Step in-flight — skipping")
            return
        }

        // ── GRACE PERIOD GATE ──────────────────────────────────────────
        val graceRemaining = stateManager.sessionReadyAt - now
        if (graceRemaining > 0) {
            logger.d("A11y", "⏳ Grace (${graceRemaining}ms left) — ignoring: ${allText.take(40)}")
            return // Do NOT set lastProcessedText here
        }

        // Grace period has passed — safe to record and process
        lastProcessedText = allText
        lastProcessedTime = now
        logger.d("A11y", "[$pkg] ${activeRequest.executionId}: ${allText.take(100)}")

        // ── ERROR DIALOG DETECTION ─────────────────────────────────────
        // Carrier rejected our input (bad session from Tier 1 collision, wrong step, etc).
        // Dismiss and fail the session immediately — no step should be sent here.
        if (isErrorDialog(allText)) {
            logger.d("A11y", "🚫 Error dialog detected: ${allText.take(80)} — dismissing and failing session")
            closeUssdDialog(root, "carrier error")
            scope.launch {
                val token = settingsManager.authTokenFlow.first()
                repository.saveAndSendResult(
                    activeRequest.executionId, "failed",
                    "Carrier rejected input: $allText", token
                )
                stateManager.clearSession()
                lastProcessedText = ""
                stepCooldownUntil = 0L
            }
            return
        }

        val nextStep = stateManager.peekNextStep()

        if (nextStep != null) {
            // ── ENTER STEP ─────────────────────────────────────────────
            logger.d("A11y", "Entering step '$nextStep' for ${activeRequest.executionId}")

            // Lock — prevents any re-entry until we confirm delivery
            stateManager.markStepInFlight()

            // Timeouts from payload or Settings
            val cooldown = activeRequest.stepCooldownMs ?: runBlocking { settingsManager.stepCooldownMsFlow.first() }
            val inputDelay = activeRequest.stepInputDelayMs ?: runBlocking { settingsManager.stepInputDelayMsFlow.first() }
            val settlingDelay = activeRequest.settlingDelayMs ?: runBlocking { settingsManager.settlingDelayMsFlow.first() }

            // Blocks events while the dialog animates to next state
            stepCooldownUntil = SystemClock.elapsedRealtime() + cooldown

            scope.launch {
                // 1. SETTLING DELAY: Wait for dialog animation to finish
                if (settlingDelay > 0) {
                    logger.d("A11y", "⏳ Settling for ${settlingDelay}ms...")
                    delay(settlingDelay)
                }

                // 2. INPUT: Get fresh root and enter text
                val inputRoot = rootInActiveWindow
                if (inputRoot != null) {
                    val entered = enterText(inputRoot, nextStep)
                    inputRoot.recycle()

                    if (entered) {
                        // 3. INPUT DELAY: Wait for UI to register input
                        delay(inputDelay)
                        
                        // 4. SEND: Get fresh root and click send
                        val sendRoot = rootInActiveWindow
                        val sent = if (sendRoot != null) {
                            val result = clickSend(sendRoot)
                            sendRoot.recycle()
                            result
                        } else {
                            false
                        }

                        if (sent) {
                            // Confirm only after both input and Send were delivered.
                            stateManager.confirmStepDelivered()
                            logger.d("A11y", "Step '$nextStep' delivered ✓")
                        } else {
                            // Do not advance the step index if Send could not be clicked.
                            logger.e("A11y", "Send action failed for step '$nextStep' — aborting without skipping")
                            abortCurrentSession("Could not submit required step '$nextStep'")
                        }
                    } else {
                        // NEVER advance the array index when the input was not delivered.
                        // Advancing here silently skips a required USSD step. Abort the
                        // session instead so the next request starts from a clean state.
                        logger.e("A11y", "Could not enter step '$nextStep' — aborting without skipping the step")
                        abortCurrentSession("Could not enter required step '$nextStep'")
                    }
                } else {
                    logger.e("A11y", "Lost window focus during settling — aborting without skipping the step")
                    abortCurrentSession("USSD dialog disappeared before required step '$nextStep' could be entered")
                }
            }

        } else {
            // ── FINAL RESPONSE ──────────────────────────────────────────
            // All steps exhausted — this is the terminal USSD reply
            logger.d("A11y", "✅ Final response for ${activeRequest.executionId}: ${allText.take(80)}")

            // Always close/cancel the terminal USSD dialog before clearing state.
            closeUssdDialog(root, "process completed")

            scope.launch {
                val token = settingsManager.authTokenFlow.first()
                repository.saveAndSendResult(
                    activeRequest.executionId,
                    "success",
                    allText,
                    token
                )
                stateManager.clearSession()
                lastProcessedText = ""
                stepCooldownUntil = 0L
                logger.d("A11y", "Result sent ✓ for ${activeRequest.executionId}")
            }
        }
    }

    /**
     * Closes the current USSD dialog. Uses a visible dismiss button first and
     * falls back to Android BACK so a terminal dialog cannot remain open.
     */
    private fun closeUssdDialog(root: AccessibilityNodeInfo?, reason: String) {
        var dismissed = false
        if (root != null) {
            dismissed = clickDismiss(root)
        }
        if (!dismissed) {
            try {
                dismissed = performGlobalAction(GLOBAL_ACTION_BACK)
            } catch (e: Exception) {
                logger.e("A11y", "Global BACK failed: ${e.message}")
            }
        }
        logger.d("A11y", "USSD dialog close requested ($reason), dismissed=$dismissed")
    }

    /** Abort an active execution without advancing/skipping its current step. */
    private fun abortCurrentSession(reason: String) {
        val request = stateManager.currentRequest.value ?: return
        scope.launch {
            val token = settingsManager.authTokenFlow.first()
            val root = rootInActiveWindow
            if (root != null) {
                try {
                    val pkg = root.packageName?.toString() ?: ""
                    if (pkg in ussdPackages) closeUssdDialog(root, reason)
                } finally {
                    root.recycle()
                }
            } else {
                try { performGlobalAction(GLOBAL_ACTION_BACK) } catch (_: Exception) {}
            }
            repository.saveAndSendResult(request.executionId, "failed", reason, token)
            stateManager.clearSession()
            lastProcessedText = ""
            stepCooldownUntil = 0L
        }
    }

    /**
     * Distinguishes a real USSD dialog/menu from the ordinary phone/in-call UI.
     * This is intentionally conservative: if there is no menu pattern or dialog
     * control, we wait rather than risking entering a step into the wrong screen.
     */
    private fun isLikelyUssdDialog(root: AccessibilityNodeInfo, text: String): Boolean {
        val lower = text.lowercase()
        val looksLikeMenu = Regex("(?m)^\\s*\\d+[.)]\\s*\\S+").containsMatchIn(text)
        val hasEditText = findNodesByClassName(root, "android.widget.EditText").isNotEmpty()
        val dialogLabels = listOf("Send", "Reply", "OK", "Ok", "Cancel", "Close", "Done", "Confirm", "Submit")
        val hasDialogButton = dialogLabels.any { label ->
            !root.findAccessibilityNodeInfosByText(label).isNullOrEmpty()
        }
        val hasKnownUssdPrompt = listOf("USSD", "menu", "balance", "select", "enter").any { lower.contains(it.lowercase()) }
        return looksLikeMenu || hasEditText || hasDialogButton || hasKnownUssdPrompt
    }

    /** Close a stale USSD dialog before a new execution begins. */
    fun closeCurrentDialogBeforeNewRequest() {
        if (!stateManager.hasActiveSession()) return
        val root = rootInActiveWindow
        if (root != null) {
            try {
                val pkg = root.packageName?.toString() ?: ""
                if (pkg in ussdPackages) {
                    closeUssdDialog(root, "new request")
                }
            } finally {
                root.recycle()
            }
        } else {
            try { performGlobalAction(GLOBAL_ACTION_BACK) } catch (_: Exception) {}
        }
        lastProcessedText = ""
        lastProcessedTime = 0L
        stepCooldownUntil = 0L
    }

    // ─── Manual scan (called by BackgroundUssdService after grace period) ─────────

    /**
     * Called from BackgroundUssdService exactly when the 3.5s grace period expires.
     * Proactively reads the current window so we don't miss a USSD dialog that appeared
     * during the grace period and is now sitting static (no new events will fire for it).
     *
     * IMPORTANT: Validates that rootInActiveWindow belongs to a phone/dialer package.
     * If it's our own app or any other app, we skip — preventing ghost captures.
     */
    fun triggerManualScan() {
        val root = rootInActiveWindow ?: return
        try {
            val pkg = root.packageName?.toString() ?: ""
            if (pkg !in ussdPackages) {
                logger.d("A11y", "Manual scan: foreground is '$pkg' (not a USSD package) — skipping to prevent ghost capture")
                return
            }
            val now = SystemClock.elapsedRealtime()
            processWindow(root, pkg, now)
        } finally {
            root.recycle()
        }
    }

    // ─── Force capture (called by Tier 3 watchdog) ────────────────────────────

    fun forceCaptureFallback(executionId: String, token: String) {
        logger.d("A11y", "⏱ Force-capture for $executionId")
        try {
            val root = rootInActiveWindow
            if (root != null) {
                val pkg = root.packageName?.toString() ?: ""
                if (pkg !in ussdPackages) {
                    // Our own app or some unrelated app is in the foreground.
                    // The USSD dialog has already closed — don't capture junk UI as a response.
                    root.recycle()
                    logger.d("A11y", "Force-capture: foreground is '$pkg' (not USSD) — sending timeout instead of ghost response")
                    scope.launch {
                        repository.saveAndSendResult(executionId, "timeout",
                            "USSD dialog closed before response was captured. Carrier session may have timed out.", token)
                        stateManager.clearSession()
                    }
                    return
                }
                val text = extractAllText(root).trim()
                root.recycle()
                if (text.isNotBlank() && text != lastProcessedText && !isLoadingScreen(text)) {
                    scope.launch {
                        repository.saveAndSendResult(executionId, "success_forced", text, token)
                        stateManager.clearSession()
                        lastProcessedText = ""
                    }
                    return
                }
            }

            scope.launch {
                repository.saveAndSendResult(
                    executionId, "timeout",
                    "No USSD dialog captured after 30s. The carrier may have responded silently.", token
                )
                stateManager.clearSession()
            }
        } catch (e: Exception) {
            logger.e("A11y", "Force-capture error: ${e.message}")
        }
    }

    // ─── Input actions ────────────────────────────────────────────────────────

    /**
     * Enters text into the USSD dialog. Returns true if input was delivered.
     * Strategy 1: EditText → ACTION_SET_TEXT (for free-form input like account numbers, pins)
     * Strategy 2: Click a button matching the step label (for numbered menus like "1", "2")
     */
    private fun enterText(root: AccessibilityNodeInfo, text: String): Boolean {
        // Strategy 1: EditText (free-form input)
        val editTexts = findNodesByClassName(root, "android.widget.EditText")
        if (editTexts.isNotEmpty()) {
            val args = Bundle()
            args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
            val ok = editTexts[0].performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
            logger.d("A11y", "EditText SET_TEXT '$text' ok=$ok")
            return ok
        }

        // Strategy 2: Click numbered menu button (e.g., "1" for option 1)
        val btn = findClickableByExactText(root, text)
        if (btn != null) {
            val ok = btn.performAction(AccessibilityNodeInfo.ACTION_CLICK)
            logger.d("A11y", "Button click '$text' ok=$ok")
            return ok
        }

        return false
    }

    private fun clickSend(root: AccessibilityNodeInfo): Boolean {
        val sendLabels = listOf("Send", "SEND", "Reply", "OK", "Ok", "Confirm", "Submit",
            "পাঠান", "ঠিক আছে", "لإرسال")
        for (label in sendLabels) {
            val nodes = root.findAccessibilityNodeInfosByText(label)
            if (!nodes.isNullOrEmpty()) {
                val clickable = nodes.mapNotNull { findClickableParent(it) }.firstOrNull()
                if (clickable != null) {
                    clickable.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                    logger.d("A11y", "Clicked send: $label")
                    return true
                }
            }
        }

        // Fallback: Generic button scan
        val buttons = findNodesByClassName(root, "android.widget.Button")
        if (buttons.isNotEmpty()) {
            // Usually the right-most / last button in a USSD dialog is the "Positive" (Send) action
            val target = buttons.last()
            if (target.isClickable) {
                target.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                logger.d("A11y", "Clicked fallback button: ${target.text ?: "no-text"}")
                return true
            }
        }

        return false
    }

    private fun clickDismiss(root: AccessibilityNodeInfo): Boolean {
        val dismissLabels = listOf("Cancel", "CANCEL", "Close", "OK", "Ok", "Done", "বাতিল")
        for (label in dismissLabels) {
            val nodes = root.findAccessibilityNodeInfosByText(label)
            if (!nodes.isNullOrEmpty()) {
                val clickable = nodes.mapNotNull { findClickableParent(it) }.firstOrNull()
                if (clickable != null && clickable.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
                    logger.d("A11y", "Dismissed USSD dialog using '$label'")
                    return true
                }
            }
        }
        return false
    }

    // ─── Loading screen detection ─────────────────────────────────────────────

    private fun isLoadingScreen(text: String): Boolean {
        // A loading screen has these transient phrases AND is short (no real menu content)
        val lower = text.lowercase()
        val hasLoadingPhrase = loadingScreenPhrases.any { lower.contains(it.lowercase()) }
        // Real USSD menus are usually longer than 30 chars and have numbered options
        val looksLikeMenu = text.length > 30 || text.contains(Regex("\\d+[.)]"))
        return hasLoadingPhrase && !looksLikeMenu
    }

    // ─── Node traversal ───────────────────────────────────────────────────────

    private fun findNodesByClassName(node: AccessibilityNodeInfo, className: String): List<AccessibilityNodeInfo> {
        val result = mutableListOf<AccessibilityNodeInfo>()
        if (node.className?.toString() == className) result.add(node)
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            result.addAll(findNodesByClassName(child, className))
        }
        return result
    }

    /** Exact text match only — prevents clicking "12" when looking for "1" */
    private fun findClickableByExactText(node: AccessibilityNodeInfo, text: String): AccessibilityNodeInfo? {
        val nodeText = node.text?.toString()?.trim()
        if (node.isClickable && nodeText == text) return node
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            val result = findClickableByExactText(child, text)
            if (result != null) return result
            child.recycle()
        }
        return null
    }

    private fun findClickableParent(node: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        var current: AccessibilityNodeInfo? = node
        while (current != null) {
            if (current.isClickable) return current
            current = current.parent
        }
        return null
    }

    private fun extractAllText(node: AccessibilityNodeInfo): String {
        val sb = StringBuilder()
        if (!node.text.isNullOrBlank()) sb.append(node.text).append("\n")
        else if (!node.contentDescription.isNullOrBlank()) sb.append(node.contentDescription).append("\n")
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            sb.append(extractAllText(child))
            child.recycle()
        }
        return sb.toString()
    }

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    override fun onInterrupt() {}

    override fun onDestroy() {
        instance = null
        job.cancel()
        super.onDestroy()
    }

    override fun onUnbind(intent: Intent?): Boolean {
        instance = null
        job.cancel()
        return super.onUnbind(intent)
    }
}
