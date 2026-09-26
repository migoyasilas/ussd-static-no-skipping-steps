package com.iot.simmanager.ui

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import dagger.hilt.android.AndroidEntryPoint

/**
 * Transparent trampoline activity.
 *
 * Android 10+ (API 29+) blocks startActivity() calls from background Services.
 * The fix: start THIS transparent activity from the service (allowed), and THIS
 * activity immediately fires ACTION_CALL (allowed because it's an Activity calling
 * another Activity, which Android permits without restriction).
 *
 * The activity is invisible to the user — theme is Translucent + NoDisplay.
 */
@AndroidEntryPoint
class UssdDialerActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val ussdCode = intent.getStringExtra(EXTRA_USSD_CODE)
        if (ussdCode.isNullOrBlank()) {
            finish()
            return
        }

        // Uri.fromParts correctly encodes the USSD code including # character
        val uri = Uri.fromParts("tel", ussdCode, null)
        val callIntent = Intent(Intent.ACTION_CALL, uri)
        startActivity(callIntent)

        // Immediately finish — we are invisible to the user
        finish()
    }

    companion object {
        const val EXTRA_USSD_CODE = "ussd_code"
    }
}
