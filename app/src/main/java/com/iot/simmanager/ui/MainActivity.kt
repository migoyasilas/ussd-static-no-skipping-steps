package com.iot.simmanager.ui

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.iot.simmanager.service.BackgroundUssdService
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // ── Keep screen always on (kiosk mode) ────────────────────────
        // This keeps the display lit whenever this Activity is visible.
        // Works with any API level; FLAG_KEEP_SCREEN_ON is the modern approach.
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // Also prevent the screen from going off when the phone auto-dims
        window.addFlags(WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)

        setContent {
            MaterialTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    SettingsScreen(onStartService = {
                        requestBatteryOptimizationExemption()
                        startUssdService()
                    })
                }
            }
        }

        // Prompt for battery exemption automatically on first launch
        requestBatteryOptimizationExemption()
    }

    /**
     * Directly launches the system dialog to exclude this app from battery optimization.
     * Without this, Android can kill the WebSocket connection when the screen goes off.
     *
     * Uses ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS which targets THIS app directly —
     * no need for the user to search through a list.
     *
     * If already exempted, does nothing.
     */
    @SuppressLint("BatteryLife")
    private fun requestBatteryOptimizationExemption() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            if (!pm.isIgnoringBatteryOptimizations(packageName)) {
                try {
                    // This opens a dialog DIRECTLY for this app — no need to search in settings
                    val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                        data = Uri.parse("package:$packageName")
                    }
                    startActivity(intent)
                } catch (e: Exception) {
                    // Fallback: open general battery optimization screen
                    try {
                        startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
                    } catch (ignored: Exception) {}
                }
            }
        }
    }

    private fun startUssdService() {
        val intent = Intent(this, BackgroundUssdService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }
}
