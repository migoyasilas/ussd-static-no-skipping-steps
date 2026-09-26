package com.iot.simmanager.ui

import android.Manifest
import android.content.Intent
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.iot.simmanager.data.local.SettingsManager
import com.iot.simmanager.data.remote.WebSocketClient
import com.iot.simmanager.utils.AppLogger
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

// ─────────────────────────────────────────────────────────────────────────────
//  Design tokens
// ─────────────────────────────────────────────────────────────────────────────
private val BgDark    = Color(0xFF0A0C10)
private val Surface   = Color(0xFF111318)
private val Surface2  = Color(0xFF181C24)
private val BorderCol = Color(0xFF1E2330)
private val Teal      = Color(0xFF00D4AA)
private val TealDim   = Color(0x2200D4AA)
private val BlueFg    = Color(0xFF4D9FFF)
private val AmberFg   = Color(0xFFF59E0B)
private val RedFg     = Color(0xFFF43F5E)
private val GreenFg   = Color(0xFF22C55E)
private val TextDim   = Color(0xFF718096)
private val TextMuted = Color(0xFF4A5568)

// ─────────────────────────────────────────────────────────────────────────────
//  ViewModel
// ─────────────────────────────────────────────────────────────────────────────
@HiltViewModel
class AppViewModel @Inject constructor(
    private val settingsManager: SettingsManager,
    private val webSocketClient: WebSocketClient,
    private val appLogger: AppLogger
) : ViewModel() {

    val backendUrl       = settingsManager.backendUrlFlow
    val authToken        = settingsManager.authTokenFlow
    val serviceEnabled   = settingsManager.serviceEnabledFlow
    val debugLogs        = settingsManager.enableDebugLogsFlow
    val executionMethod  = settingsManager.executionMethodFlow
    val screenAlwaysOn   = settingsManager.screenAlwaysOnFlow
    val gracePeriodMs    = settingsManager.gracePeriodMsFlow
    val stepCooldownMs   = settingsManager.stepCooldownMsFlow
    val stepInputDelayMs = settingsManager.stepInputDelayMsFlow
    val tier1TimeoutMs   = settingsManager.tier1TimeoutMsFlow
    val tier2TimeoutMs   = settingsManager.tier2TimeoutMsFlow
    val settlingDelayMs  = settingsManager.settlingDelayMsFlow
    val loadingPhrases   = settingsManager.loadingPhrasesFlow
    val connectionState  = webSocketClient.connectionState
    val logs             = appLogger.logs

    fun save(block: suspend SettingsManager.() -> Unit) = viewModelScope.launch { block(settingsManager) }
    fun clearLogs() = appLogger.clear()
    fun toggleDebugLogs(on: Boolean) = viewModelScope.launch {
        settingsManager.setEnableDebugLogs(on)
        appLogger.isLoggingEnabled = on
    }
}
// Alias so old references still compile
typealias SettingsViewModel = AppViewModel

// ─────────────────────────────────────────────────────────────────────────────
//  Entry — 4-tab shell
// ─────────────────────────────────────────────────────────────────────────────
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    viewModel: AppViewModel = hiltViewModel(),
    onStartService: () -> Unit
) {
    val context = LocalContext.current
    val isConnected by viewModel.connectionState.collectAsState()
    var selectedTab by remember { mutableStateOf(0) }
    var permissionsGranted by remember { mutableStateOf(false) }

    val permLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results -> permissionsGranted = results.values.all { it } }

    LaunchedEffect(Unit) {
        val perms = mutableListOf(
            Manifest.permission.CALL_PHONE, Manifest.permission.READ_PHONE_STATE,
            Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
            perms.add(Manifest.permission.POST_NOTIFICATIONS)
        permLauncher.launch(perms.toTypedArray())
    }

    Scaffold(
        containerColor = BgDark,
        topBar = {
            Surface(color = Surface, shadowElevation = 0.dp, tonalElevation = 0.dp) {
                Column {
                    // Title row
                    Row(
                        modifier = Modifier.fillMaxWidth()
                            .padding(horizontal = 20.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Eksses Payment api", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = Teal)
                            Text("EPA Gateway • Samir Bhuiyan", fontSize = 11.sp, color = TextDim)
                        }
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Box(
                                modifier = Modifier.size(8.dp).clip(CircleShape)
                                    .background(if (isConnected) GreenFg else RedFg)
                            )
                            Text(
                                text = if (isConnected) "Connected" else "Disconnected",
                                fontSize = 12.sp,
                                color = if (isConnected) GreenFg else RedFg,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }

                    // Tabs
                    val tabs = listOf(
                        Pair(Icons.Filled.Home, "Dashboard"),
                        Pair(Icons.Filled.AccessTime, "Timing"),
                        Pair(Icons.Filled.Cloud, "Connection"),
                        Pair(Icons.Filled.Code, "Console")
                    )
                    ScrollableTabRow(
                        selectedTabIndex = selectedTab,
                        containerColor = Surface,
                        contentColor = Teal,
                        edgePadding = 0.dp,
                        indicator = { positions ->
                            TabRowDefaults.Indicator(
                                modifier = Modifier.tabIndicatorOffset(positions[selectedTab]),
                                color = Teal, height = 2.dp
                            )
                        },
                        divider = { Divider(color = BorderCol) }
                    ) {
                        tabs.forEachIndexed { i, (icon, label) ->
                            Tab(
                                selected = selectedTab == i,
                                onClick = { selectedTab = i },
                                selectedContentColor = Teal,
                                unselectedContentColor = TextDim
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Icon(icon, null, modifier = Modifier.size(15.dp))
                                    Text(label, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                                }
                            }
                        }
                    }
                }
            }
        },
        bottomBar = {
            Surface(color = Surface, tonalElevation = 0.dp) {
                Divider(color = BorderCol)
                Row(
                    modifier = Modifier.fillMaxWidth().padding(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Button(
                        onClick = {
                            if (isConnected) {
                                val stopIntent = Intent(context, com.iot.simmanager.service.BackgroundUssdService::class.java).apply {
                                    action = com.iot.simmanager.service.BackgroundUssdService.ACTION_STOP
                                }
                                context.startService(stopIntent)
                                viewModel.save { setServiceEnabled(false) }
                            } else {
                                viewModel.save { setServiceEnabled(true) }
                                onStartService()
                            }
                        },
                        enabled = permissionsGranted,
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (!permissionsGranted) TextMuted else (if (isConnected) RedFg else Teal),
                            contentColor = BgDark
                        ),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Icon(if (isConnected) Icons.Filled.Stop else Icons.Filled.PlayArrow, null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text(
                            if (!permissionsGranted) "Grant Permissions" 
                            else if (isConnected) "Stop Engine" 
                            else "Start Engine",
                            fontWeight = FontWeight.Bold
                        )
                    }
                    OutlinedButton(
                        onClick = { context.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)) },
                        border = BorderStroke(1.dp, BorderCol),
                        shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = TextDim)
                    ) { Text("A11y", fontSize = 12.sp) }
                }
            }
        }
    ) { padding ->
        Box(modifier = Modifier.padding(padding)) {
            when (selectedTab) {
                0 -> DashboardTab(viewModel, context, permissionsGranted)
                1 -> TimingTab(viewModel)
                2 -> ConnectionTab(viewModel)
                3 -> ConsoleTab(viewModel)
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Tab 0 — Dashboard
// ─────────────────────────────────────────────────────────────────────────────
@Composable
fun DashboardTab(vm: AppViewModel, context: android.content.Context, permsOk: Boolean) {
    val isConnected by vm.connectionState.collectAsState()
    val screenOn    by vm.screenAlwaysOn.collectAsState(initial = true)
    val debugOn     by vm.debugLogs.collectAsState(initial = true)
    val method      by vm.executionMethod.collectAsState(initial = "ACCESSIBILITY")

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
            StatusCard(
                Modifier.weight(1f), "WebSocket",
                if (isConnected) "Connected" else "Offline",
                if (isConnected) GreenFg else RedFg,
                Icons.Filled.WifiTethering
            )
            StatusCard(
                Modifier.weight(1f), "Permissions",
                if (permsOk) "All Granted" else "Missing",
                if (permsOk) GreenFg else AmberFg,
                Icons.Filled.Lock
            )
        }

        CardSection("📱 SIM Hardware") { SimHardwareContent(context) }

        CardSection("⚡ Quick Toggles") {
            QuickToggle("Screen Always On", "Keeps display lit while service runs", screenOn) {
                vm.save { setScreenAlwaysOn(it) }
            }
            QuickToggle("Debug Logging", "Record all internal events to console", debugOn) {
                vm.toggleDebugLogs(it)
            }
        }

        CardSection("🔧 System Settings") {
            Row(
                modifier = Modifier.fillMaxWidth().background(TealDim, RoundedCornerShape(8.dp)).padding(10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(Icons.Filled.FlashOn, null, tint = Teal, modifier = Modifier.size(14.dp))
                Spacer(Modifier.width(8.dp))
                Text("Set to 'Unrestricted' for 24/7 background uptime.", fontSize = 10.sp, color = Teal)
            }
            Spacer(Modifier.height(8.dp))
            BtnRow("Battery Optimization") {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    context.startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
                }
            }
            Spacer(Modifier.height(8.dp))
            BtnRow("Accessibility Services") {
                context.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
            }
        }

        Spacer(Modifier.height(24.dp))
        Column(
            modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text("Eksses Payment api {EPA}", fontSize = 11.sp, color = TextMuted)
            Text("Developer: Samir Bhuiyan | v1.0.0", fontSize = 10.sp, color = TextMuted)
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Tab 1 — Timing
// ─────────────────────────────────────────────────────────────────────────────
@Composable
fun TimingTab(vm: AppViewModel) {
    val grace   by vm.gracePeriodMs.collectAsState(initial = 3500L)
    val cool    by vm.stepCooldownMs.collectAsState(initial = 2000L)
    val delay   by vm.stepInputDelayMs.collectAsState(initial = 300L)
    val tier1   by vm.tier1TimeoutMs.collectAsState(initial = 15000L)
    val tier2   by vm.tier2TimeoutMs.collectAsState(initial = 30000L)
    val settle  by vm.settlingDelayMs.collectAsState(initial = 400L)
    val phrases by vm.loadingPhrases.collectAsState(initial = "")

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        InfoBanner("Changes apply to next command — no recompile needed.")

        CardSection("🛡️ Ghost Input Prevention") {
            TimingField(
                label = "Grace Period", value = grace, unit = "ms",
                description = "How long to ignore all accessibility events after the dialer opens. Prevents entering steps into the in-call screen before your USSD dialog appears. Increase if you still see ghost inputs.",
                min = 500L, max = 10000L, step = 500L
            ) { vm.save { setGracePeriodMs(it) } }
            Spacer(Modifier.height(14.dp))
            TimingField(
                label = "Step Cooldown", value = cool, unit = "ms",
                description = "Blocks all accessibility events after each step is entered. Prevents the same step from being re-sent while the USSD dialog is animating to its next state.",
                min = 500L, max = 8000L, step = 250L
            ) { vm.save { setStepCooldownMs(it) } }
        }

        CardSection("⌨️ Input Timing") {
            TimingField(
                label = "Settling Delay", value = settle, unit = "ms",
                description = "Wait time AFTER a new menu appears but BEFORE the first input is typed. Essential for slow-to-load menus to prevent 'ghost' typing while the box is animating. Increase this if you see steps being skipped.",
                min = 50L, max = 2000L, step = 50L
            ) { vm.save { setSettlingDelayMs(it) } }
            Spacer(Modifier.height(14.dp))
            TimingField(
                label = "Input → Send Delay", value = delay, unit = "ms",
                description = "Wait time between typing the step value and tapping Send. Gives the keyboard time to register text before the button is clicked.",
                min = 100L, max = 2000L, step = 100L
            ) { vm.save { setStepInputDelayMs(it) } }
        }

        CardSection("⏱️ Timeouts") {
            TimingField(
                label = "USSD Response Timeout", value = tier2, unit = "ms",
                description = "Max wait for the Accessibility Service to capture a response after the dialer opens. Tier 3 force-scan runs after this.",
                min = 10000L, max = 60000L, step = 5000L
            ) { vm.save { setTier2TimeoutMs(it) } }
        }

        CardSection("🚫 Loading Screen Filter") {
            Text(
                "Comma-separated phrases that identify a carrier loading screen (not the real menu). " +
                "Matching text is skipped so the session stays alive until the real USSD menu arrives.",
                fontSize = 11.sp, color = TextDim, lineHeight = 16.sp
            )
            Spacer(Modifier.height(8.dp))
            var phraseText by remember(phrases) { mutableStateOf(phrases) }
            OutlinedTextField(
                value = phraseText,
                onValueChange = { phraseText = it },
                label = { Text("Loading Screen Phrases") },
                modifier = Modifier.fillMaxWidth(),
                colors = appFieldColors(),
                minLines = 2
            )
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = { vm.save { setLoadingPhrases(phraseText) } },
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(containerColor = Teal, contentColor = BgDark),
                    shape = RoundedCornerShape(6.dp)
                ) { Text("Save", fontWeight = FontWeight.Bold) }
                OutlinedButton(
                    onClick = {
                        phraseText = "Running USSD code,Please wait,Connecting,Dialing,Processing"
                        vm.save { setLoadingPhrases(phraseText) }
                    },
                    border = BorderStroke(1.dp, BorderCol),
                    shape = RoundedCornerShape(6.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = TextDim)
                ) { Text("↺ Reset") }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Tab 2 — Connection
// ─────────────────────────────────────────────────────────────────────────────
@Composable
fun ConnectionTab(vm: AppViewModel) {
    val url   by vm.backendUrl.collectAsState(initial = "")
    val token by vm.authToken.collectAsState(initial = "")
    var urlText   by remember(url)   { mutableStateOf(url)   }
    var tokenText by remember(token) { mutableStateOf(token) }
    var saved by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        CardSection("🌐 Backend Server") {
            Text("WebSocket URL", fontSize = 11.sp, color = TextDim)
            Spacer(Modifier.height(4.dp))
            OutlinedTextField(
                value = urlText, onValueChange = { urlText = it; saved = false },
                label = { Text("ws://IP:3000/ws") },
                modifier = Modifier.fillMaxWidth(),
                colors = appFieldColors(), singleLine = true
            )
            Spacer(Modifier.height(10.dp))
            Text("Auth Token", fontSize = 11.sp, color = TextDim)
            Spacer(Modifier.height(4.dp))
            OutlinedTextField(
                value = tokenText, onValueChange = { tokenText = it; saved = false },
                label = { Text("Leave blank if none") },
                modifier = Modifier.fillMaxWidth(),
                colors = appFieldColors(), singleLine = true
            )
            Spacer(Modifier.height(12.dp))
            Button(
                onClick = {
                    vm.save { saveBackendUrl(urlText); saveAuthToken(tokenText) }
                    saved = true
                },
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (saved) GreenFg else Teal,
                    contentColor = BgDark
                ),
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(
                    if (saved) Icons.Filled.Check else Icons.Filled.CheckCircle,
                    null, modifier = Modifier.size(16.dp)
                )
                Spacer(Modifier.width(6.dp))
                Text(if (saved) "Saved!" else "Save Connection Settings", fontWeight = FontWeight.Bold)
            }
        }

        CardSection("ℹ️ Quick Tips") {
            Text("• Reconnect the app after changing the URL.", fontSize = 11.sp, color = TextDim)
            Spacer(Modifier.height(6.dp))
            Text("ws://192.168.x.x:3000/ws   ← Local WiFi", fontSize = 11.sp,
                color = TextMuted, fontFamily = FontFamily.Monospace)
            Spacer(Modifier.height(4.dp))
            Text("ws://100.x.x.x:3000/ws    ← Tailscale VPN", fontSize = 11.sp,
                color = TextMuted, fontFamily = FontFamily.Monospace)
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Tab 3 — Console
// ─────────────────────────────────────────────────────────────────────────────
@Composable
fun ConsoleTab(vm: AppViewModel) {
    val logs by vm.logs.collectAsState()
    val listState = rememberLazyListState()
    LaunchedEffect(logs.size) { if (logs.isNotEmpty()) listState.animateScrollToItem(0) }

    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier.fillMaxWidth().background(Surface)
                .padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("${logs.size} entries", fontSize = 11.sp, color = TextDim)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                val clipboard = LocalClipboardManager.current
                TextButton(
                    onClick = {
                        val text = logs.joinToString("\n")
                        clipboard.setText(AnnotatedString(text))
                    },
                    contentPadding = PaddingValues(4.dp)
                ) {
                    Icon(Icons.Filled.ContentCopy, null, modifier = Modifier.size(14.dp), tint = Teal)
                    Spacer(Modifier.width(4.dp))
                    Text("Copy All", fontSize = 11.sp, color = Teal)
                }
                TextButton(
                    onClick = { vm.clearLogs() },
                    contentPadding = PaddingValues(4.dp)
                ) {
                    Icon(Icons.Filled.Delete, null, modifier = Modifier.size(14.dp), tint = RedFg)
                    Spacer(Modifier.width(4.dp))
                    Text("Clear", fontSize = 11.sp, color = RedFg)
                }
            }
        }
        Divider(color = BorderCol)
        Box(modifier = Modifier.fillMaxSize().background(Color(0xFF060809))) {
            if (logs.isEmpty()) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("No logs yet — start the engine", color = TextMuted, fontSize = 12.sp)
                }
            } else {
                LazyColumn(
                    state = listState,
                    reverseLayout = true,
                    modifier = Modifier.fillMaxSize().padding(8.dp)
                ) {
                    items(logs.reversed()) { log ->
                        val color = when {
                            log.contains("✅") || log.contains("success", true) -> Teal
                            log.contains("❌") || log.contains("error", true)
                                || log.contains("fail", true) -> RedFg
                            log.contains("⚠️") || log.contains("warn", true) -> AmberFg
                            log.contains("💓") || log.contains("heartbeat", true) -> GreenFg
                            else -> Color(0xFF8A9BB0)
                        }
                        Text(
                            log, color = color, fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace, lineHeight = 15.sp,
                            modifier = Modifier.padding(bottom = 2.dp)
                        )
                    }
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Shared components
// ─────────────────────────────────────────────────────────────────────────────

@Composable
fun CardSection(title: String, content: @Composable ColumnScope.() -> Unit) {
    Surface(
        color = Surface, shape = RoundedCornerShape(10.dp), tonalElevation = 0.dp,
        border = BorderStroke(1.dp, BorderCol)
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(14.dp)) {
            Text(
                title, fontSize = 12.sp, fontWeight = FontWeight.SemiBold,
                color = Color.White, modifier = Modifier.padding(bottom = 12.dp)
            )
            content()
        }
    }
}

@Composable
fun StatusCard(modifier: Modifier, label: String, value: String, color: Color, icon: ImageVector) {
    Surface(
        modifier = modifier, color = Surface,
        shape = RoundedCornerShape(10.dp), border = BorderStroke(1.dp, BorderCol)
    ) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Icon(icon, null, tint = color, modifier = Modifier.size(18.dp))
            Text(label, fontSize = 10.sp, color = TextDim)
            Text(value, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = color)
        }
    }
}

@Composable
fun QuickToggle(title: String, sub: String, checked: Boolean, onToggle: (Boolean) -> Unit) {
    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Column(modifier = Modifier.weight(1f).padding(end = 12.dp)) {
            Text(title, fontSize = 13.sp, color = Color.White, fontWeight = FontWeight.Medium)
            Text(
                sub, fontSize = 10.sp, color = TextDim,
                lineHeight = 14.sp, modifier = Modifier.padding(top = 2.dp)
            )
        }
        Switch(
            checked = checked, onCheckedChange = onToggle,
            colors = SwitchDefaults.colors(
                checkedThumbColor = BgDark, checkedTrackColor = Teal,
                uncheckedThumbColor = TextDim, uncheckedTrackColor = Surface2
            )
        )
    }
}

@Composable
fun TimingField(
    label: String, value: Long, unit: String,
    description: String, min: Long, max: Long, step: Long,
    onSave: (Long) -> Unit
) {
    var text by remember(value) { mutableStateOf(value.toString()) }
    val parsed = text.toLongOrNull()?.coerceIn(min, max) ?: value
    val progress = ((parsed - min).toFloat() / (max - min)).coerceIn(0f, 1f)

    Text(label, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = Color.White)
    Text(
        description, fontSize = 10.sp, color = TextDim,
        lineHeight = 14.sp, modifier = Modifier.padding(top = 2.dp, bottom = 8.dp)
    )

    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedTextField(
            value = text,
            onValueChange = { text = it.filter(Char::isDigit) },
            modifier = Modifier.weight(1f),
            singleLine = true,
            suffix = { Text(unit, color = TextDim, fontSize = 11.sp) },
            colors = appFieldColors()
        )
        Box(
            modifier = Modifier.size(36.dp).clip(RoundedCornerShape(6.dp))
                .background(Surface2).clickable {
                    text = (parsed - step).coerceAtLeast(min).toString()
                },
            contentAlignment = Alignment.Center
        ) { Text("−", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp) }
        Box(
            modifier = Modifier.size(36.dp).clip(RoundedCornerShape(6.dp))
                .background(Surface2).clickable {
                    text = (parsed + step).coerceAtMost(max).toString()
                },
            contentAlignment = Alignment.Center
        ) { Text("+", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp) }
        Button(
            onClick = { onSave(parsed) },
            colors = ButtonDefaults.buttonColors(containerColor = Teal, contentColor = BgDark),
            shape = RoundedCornerShape(6.dp),
            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 10.dp)
        ) { Text("Set", fontWeight = FontWeight.Bold, fontSize = 12.sp) }
    }

    // Progress bar + range labels
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text("$min$unit", fontSize = 9.sp, color = TextMuted)
        LinearProgressIndicator(
            progress = progress,
            modifier = Modifier.weight(1f).padding(horizontal = 8.dp).height(4.dp)
                .clip(RoundedCornerShape(2.dp)),
            color = Teal,
            trackColor = BorderCol
        )
        Text("$max$unit", fontSize = 9.sp, color = TextMuted)
    }
}

@Composable
fun BtnRow(label: String, onClick: () -> Unit) {
    OutlinedButton(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        border = BorderStroke(1.dp, BorderCol),
        shape = RoundedCornerShape(8.dp),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White)
    ) {
        Text(label, fontSize = 13.sp, modifier = Modifier.weight(1f))
        Icon(Icons.Filled.ArrowForward, null, modifier = Modifier.size(14.dp), tint = TextDim)
    }
}

@Composable
fun InfoBanner(text: String) {
    Row(
        modifier = Modifier.fillMaxWidth()
            .background(TealDim, RoundedCornerShape(8.dp)).padding(10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Icon(Icons.Filled.Info, null, tint = Teal, modifier = Modifier.size(16.dp))
        Text(text, fontSize = 11.sp, color = Teal, lineHeight = 16.sp)
    }
}

@Composable
fun SimHardwareContent(context: android.content.Context) {
    var simCards by remember { mutableStateOf<List<String>>(emptyList()) }
    LaunchedEffect(Unit) {
        try {
            val sm = context.getSystemService(android.content.Context.TELEPHONY_SUBSCRIPTION_SERVICE)
                    as android.telephony.SubscriptionManager
            simCards = sm.activeSubscriptionInfoList
                ?.map { "SIM ${it.simSlotIndex}: ${it.carrierName}" } ?: emptyList()
        } catch (_: SecurityException) {
            simCards = listOf("Permission denied")
        }
    }
    if (simCards.isEmpty()) {
        Text("No SIM detected or single-SIM device.", fontSize = 12.sp, color = TextDim)
    } else {
        simCards.forEach { sim ->
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.padding(vertical = 3.dp)
            ) {
                Box(Modifier.size(7.dp).clip(CircleShape).background(Teal))
                Text(sim, fontSize = 12.sp, color = Color.White)
            }
        }
    }
}

@Composable
fun appFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = Teal, unfocusedBorderColor = BorderCol,
    focusedLabelColor = Teal, unfocusedLabelColor = TextDim,
    focusedTextColor = Color.White, unfocusedTextColor = Color.White,
    cursorColor = Teal,
    unfocusedContainerColor = Surface2, focusedContainerColor = Surface2
)
