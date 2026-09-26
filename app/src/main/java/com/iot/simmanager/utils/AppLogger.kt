package com.iot.simmanager.utils

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AppLogger @Inject constructor() {
    private val maxLogs = 500
    private val _logs = MutableStateFlow<List<String>>(emptyList())
    val logs: StateFlow<List<String>> = _logs.asStateFlow()

    private val dateFormat = SimpleDateFormat("HH:mm:ss", Locale.getDefault())

    var isLoggingEnabled: Boolean = true

    /**
     * Set by BackgroundUssdService to forward log entries to the backend.
     * Uses a raw send path that does NOT itself generate log entries (no recursion).
     */
    var onNewLog: ((String) -> Unit)? = null

    fun d(tag: String, message: String) {
        android.util.Log.d(tag, message)
        appendLog("[DEBUG] [$tag] $message")
    }

    fun e(tag: String, message: String, t: Throwable? = null) {
        android.util.Log.e(tag, message, t)
        appendLog("[ERROR] [$tag] $message ${t?.message ?: ""}")
    }

    private fun appendLog(msg: String) {
        if (!isLoggingEnabled) return
        val time = dateFormat.format(Date())
        val entry = "[$time] $msg"

        val currentList = _logs.value.toMutableList()
        currentList.add(entry)
        if (currentList.size > maxLogs) currentList.removeAt(0)
        _logs.value = currentList

        // Forward to backend (callback avoids circular WS logging)
        onNewLog?.invoke(entry)
    }

    fun clear() {
        _logs.value = emptyList()
    }
}

