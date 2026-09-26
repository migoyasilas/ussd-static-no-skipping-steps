package com.iot.simmanager.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "settings")

class SettingsManager(private val context: Context) {

    companion object {
        val BACKEND_URL        = stringPreferencesKey("backend_url")
        val AUTH_TOKEN         = stringPreferencesKey("auth_token")
        val EXECUTION_METHOD   = stringPreferencesKey("execution_method")
        val SERVICE_ENABLED    = booleanPreferencesKey("service_enabled")
        val WEBSOCKET_FALLBACK = booleanPreferencesKey("websocket_fallback")
        val ENABLE_DEBUG_LOGS  = booleanPreferencesKey("enable_debug_logs")

        // ── Timing parameters — editable from the app without recompiling ──
        val GRACE_PERIOD_MS     = longPreferencesKey("grace_period_ms")
        val STEP_COOLDOWN_MS    = longPreferencesKey("step_cooldown_ms")
        val STEP_INPUT_DELAY_MS = longPreferencesKey("step_input_delay_ms")
        val TIER2_TIMEOUT_MS    = longPreferencesKey("tier2_timeout_ms")
        val TIER1_TIMEOUT_MS    = longPreferencesKey("tier1_timeout_ms")
        val SETTLING_DELAY_MS   = longPreferencesKey("settling_delay_ms")

        // ── Loading screen filter phrases (comma-separated) ──────────────
        val LOADING_PHRASES = stringPreferencesKey("loading_phrases")

        // ── Screen always on ─────────────────────────────────────────────
        val SCREEN_ALWAYS_ON = booleanPreferencesKey("screen_always_on")
    }

    val backendUrlFlow:       Flow<String>  = context.dataStore.data.map { it[BACKEND_URL]        ?: "ws://192.168.1.105:3000/ws" }
    val authTokenFlow:        Flow<String>  = context.dataStore.data.map { it[AUTH_TOKEN]         ?: "" }
    val executionMethodFlow:  Flow<String>  = context.dataStore.data.map { it[EXECUTION_METHOD]   ?: "ACCESSIBILITY" }
    val serviceEnabledFlow:   Flow<Boolean> = context.dataStore.data.map { it[SERVICE_ENABLED]    ?: true }
    val websocketFallbackFlow:Flow<Boolean> = context.dataStore.data.map { it[WEBSOCKET_FALLBACK] ?: true }
    val enableDebugLogsFlow:  Flow<Boolean> = context.dataStore.data.map { it[ENABLE_DEBUG_LOGS]  ?: true }
    val screenAlwaysOnFlow:   Flow<Boolean> = context.dataStore.data.map { it[SCREEN_ALWAYS_ON]   ?: true }

    val gracePeriodMsFlow:    Flow<Long>    = context.dataStore.data.map { it[GRACE_PERIOD_MS]     ?: 3500L }
    val stepCooldownMsFlow:   Flow<Long>    = context.dataStore.data.map { it[STEP_COOLDOWN_MS]    ?: 2000L }
    val stepInputDelayMsFlow: Flow<Long>    = context.dataStore.data.map { it[STEP_INPUT_DELAY_MS] ?: 300L  }
    val tier2TimeoutMsFlow:   Flow<Long>    = context.dataStore.data.map { it[TIER2_TIMEOUT_MS]    ?: 30000L }
    val tier1TimeoutMsFlow:   Flow<Long>    = context.dataStore.data.map { it[TIER1_TIMEOUT_MS]    ?: 15000L }
    val settlingDelayMsFlow:  Flow<Long>    = context.dataStore.data.map { it[SETTLING_DELAY_MS]   ?: 400L }
    val loadingPhrasesFlow:   Flow<String>  = context.dataStore.data.map {
        it[LOADING_PHRASES] ?: "Running USSD code,Please wait,Connecting,Dialing,Processing"
    }

    suspend fun saveBackendUrl(url: String)          = context.dataStore.edit { it[BACKEND_URL]        = url     }
    suspend fun saveAuthToken(token: String)          = context.dataStore.edit { it[AUTH_TOKEN]         = token   }
    suspend fun setExecutionMethod(method: String)    = context.dataStore.edit { it[EXECUTION_METHOD]   = method  }
    suspend fun setServiceEnabled(enabled: Boolean)   = context.dataStore.edit { it[SERVICE_ENABLED]    = enabled }
    suspend fun setWebsocketFallback(enabled: Boolean)= context.dataStore.edit { it[WEBSOCKET_FALLBACK] = enabled }
    suspend fun setEnableDebugLogs(enabled: Boolean)  = context.dataStore.edit { it[ENABLE_DEBUG_LOGS]  = enabled }
    suspend fun setScreenAlwaysOn(enabled: Boolean)   = context.dataStore.edit { it[SCREEN_ALWAYS_ON]   = enabled }

    suspend fun setGracePeriodMs(v: Long)    = context.dataStore.edit { it[GRACE_PERIOD_MS]     = v }
    suspend fun setStepCooldownMs(v: Long)   = context.dataStore.edit { it[STEP_COOLDOWN_MS]    = v }
    suspend fun setStepInputDelayMs(v: Long) = context.dataStore.edit { it[STEP_INPUT_DELAY_MS] = v }
    suspend fun setTier2TimeoutMs(v: Long)   = context.dataStore.edit { it[TIER2_TIMEOUT_MS]    = v }
    suspend fun setTier1TimeoutMs(v: Long)   = context.dataStore.edit { it[TIER1_TIMEOUT_MS]    = v }
    suspend fun setSettlingDelayMs(v: Long)  = context.dataStore.edit { it[SETTLING_DELAY_MS]   = v }
    suspend fun setLoadingPhrases(v: String) = context.dataStore.edit { it[LOADING_PHRASES]     = v }
}
