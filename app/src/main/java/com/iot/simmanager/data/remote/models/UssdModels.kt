package com.iot.simmanager.data.remote.models

import com.google.gson.annotations.SerializedName

data class UssdRequest(
    @SerializedName("execution_id") val executionId: String,
    @SerializedName("ussd_code") val ussdCode: String,
    @SerializedName("steps") val steps: List<String>?,
    @SerializedName("timeout") val timeout: Long? = 15000,
    @SerializedName("sim_slot") val simSlot: Int? = null,

    // ── Timing parameters — configurable from the dashboard UI ──────
    // Change these live without recompiling the Android app.

    /** How long (ms) to ignore accessibility events after the dialer launches.
     *  Prevents ghost inputs into the in-call screen before the USSD dialog appears. */
    @SerializedName("grace_period_ms") val gracePeriodMs: Long? = 3500,

    /** How long (ms) to block events after each step is delivered.
     *  Prevents the same step being re-entered while the dialog is animating. */
    @SerializedName("step_cooldown_ms") val stepCooldownMs: Long? = 2000,

    /** How long (ms) to wait between typing the step text and clicking Send.
     *  Gives the UI time to register the input before we tap the button. */
    @SerializedName("step_input_delay_ms") val stepInputDelayMs: Long? = 300,

    /** How long (ms) to wait for Tier 2 (visible dialer) before Tier 3 force-scan. */
    @SerializedName("tier2_timeout_ms") val tier2TimeoutMs: Long? = 30000,

    /** How long (ms) to wait after menu detection before first input action. 
     *  Prevents race conditions with carrier dialog animations. */
    @SerializedName("settling_delay_ms") val settlingDelayMs: Long? = 400
)

data class UssdResponse(
    @SerializedName("execution_id") val executionId: String,
    @SerializedName("status") val status: String,
    @SerializedName("response") val response: String
)
