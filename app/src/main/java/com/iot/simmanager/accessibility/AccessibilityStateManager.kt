package com.iot.simmanager.accessibility

import android.os.SystemClock
import com.iot.simmanager.data.remote.models.UssdRequest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Manages the state of an in-progress multi-step USSD session.
 *
 * CRITICAL: getNextStep() uses a PEEK+CONFIRM model to prevent ghost inputs:
 *   1. peekNextStep()  → returns next step WITHOUT advancing the index
 *   2. confirmStepDelivered() → advances the index AFTER the step was actually sent
 *
 * Previously getNextStep() advanced immediately, so duplicate events
 * (TYPE_WINDOW_CONTENT_CHANGED fires ~10x per interaction) caused the same
 * step to be sent multiple times, or different steps to be sent out of order.
 */
@Singleton
class AccessibilityStateManager @Inject constructor() {

    private val _currentRequest = MutableStateFlow<UssdRequest?>(null)
    val currentRequest = _currentRequest.asStateFlow()

    private var currentStepIndex = 0

    /** Whether we are currently waiting for a step to be delivered (cooldown active) */
    @Volatile var stepInFlight = false
        private set

    /**
     * Timestamp after which the session is ready to accept accessibility input.
     * Set to SystemClock.elapsedRealtime() + 3000ms on startSession().
     *
     * Purpose: prevents ghost inputs into the dialer's in-call screen that appears
     * briefly BEFORE the actual USSD response dialog. The in-call screen is also
     * from com.android.phone, so without this guard the first step gets entered
     * into the wrong window, then entered again correctly — causing "wrong menu" errors.
     */
    @Volatile var sessionReadyAt = 0L
        private set

    fun startSession(request: UssdRequest) {
        _currentRequest.value = request
        currentStepIndex = 0
        stepInFlight = false
        // Use grace period from the request payload (set in dashboard, defaults to 3500ms)
        // This prevents ghost inputs into the dialer's in-call screen
        val gracePeriod = request.gracePeriodMs ?: 3500L
        sessionReadyAt = SystemClock.elapsedRealtime() + gracePeriod
    }

    /**
     * Returns the current pending step WITHOUT advancing the index.
     * Returns null if:
     *   - All steps are exhausted (final response state)
     *   - Session is not ready yet (grace period to prevent ghost inputs)
     */
    fun peekNextStep(): String? {
        // Enforce grace period — don't enter any steps until dialer has fully loaded
        if (SystemClock.elapsedRealtime() < sessionReadyAt) return null
        val req = _currentRequest.value ?: return null
        val steps = req.steps ?: return null
        return if (currentStepIndex < steps.size) steps[currentStepIndex] else null
    }

    /**
     * Call this AFTER the step has been physically entered into the UI.
     * Advances to the next step and releases the in-flight lock.
     */
    fun confirmStepDelivered() {
        currentStepIndex++
        stepInFlight = false
    }

    /**
     * Marks the current step as being delivered (prevents re-entry on duplicate events).
     */
    fun markStepInFlight() {
        stepInFlight = true
    }

    fun hasMoreSteps(): Boolean {
        val req = _currentRequest.value ?: return false
        val steps = req.steps ?: return false
        return currentStepIndex < steps.size
    }

    fun clearSession() {
        _currentRequest.value = null
        currentStepIndex = 0
        stepInFlight = false
        sessionReadyAt = 0L
    }

    /** True while a USSD execution is active. */
    fun hasActiveSession(): Boolean = _currentRequest.value != null
}
