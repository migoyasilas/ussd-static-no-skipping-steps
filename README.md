# IoT SIM Manager: Senior Engineering Masterclass & Roadmap

Welcome to the definitive backend-driven Android background telecom project. This `README` serves as a master architecture guide, detailing *exactly* how the background engines interface with Android OS restrictions, how USSD APIs operate contextually, the app's current capabilities, and a roadmap for the future.

---

## 🚀 Project Goals & Overview

The central goal of **IoT SIM Manager** is to convert any cheap Android smartphone into a headless, physical "API Node." 

By connecting thousands of Android devices continuously via persistent WebSockets, backend systems can trigger real-time physical carrier actions (such as checking balances, buying data packages, or sending network queries) entirely through background automation without *any* human interaction on the phone itself!

### What Does the App Do Today?
✅ **Dual-SIM Target Execution**: Executes USSD directly onto `SIM 1` or `SIM 2` utilizing Android's deep `SubscriptionManager`.
✅ **Diagnostic Live UI**: Real-time status screens. App prompts automatically for rigorous permissions (Storage, SMS, Telephony, Networking, Notifications) before unlocking the engine. Deep-links directly to Accessibility overrides.
✅ **Multi-Step DOM Crawling**: Can execute sequential menus automatically (e.g., dial, reply "1", reply "2", send).
✅ **Automatic Sync Queue**: If the WebSocket drops due to carrier dead-zones, results pile into the internal Room database and fire to a webhook payload the minute data returns via a `WorkManager Watchdog`.
✅ **Cloud Dashboard Simulation**: A completely bundled Node.js Master Server capable of targeting and commanding devices from an HTML dashboard.

---

## 🏗 System Architecture (A to Z)

The underlying Android codebase is formulated around modern *Clean Architecture* to isolate telecom quirks from business logic.

### 1. Network & Sync Layer (Data)
The system holds a permanent WebSocket tunnel (`WebSocketClient.kt`) to your central server. To tackle sudden battery-saving modes or network drops:
* **The Room DB Queue**: Every executed USSD command saves its result to a local Room Database (`AppDatabase.kt`) instantly before attempting delivery.
* **The Watchdog**: The `UssdWatchdogWorker.kt` (leveraging WorkManager) acts as a background Cron Job. It sweeps un-synced requests and attempts to POST them to the backend API (`BackendApi.kt`), guaranteeing *at-least-once delivery*.

### 2. Dual Execution Engine (Domain -> Telecom)
Running USSD codes in the background silently is incredibly challenging due to strict Android privacy security constraints. To guarantee success across all vendor OEMs (Samsung, Xiaomi, custom ROMs), we employ a *Dual Engine* strategy natively bypass limitations:

#### Method A: Telephony API (Silent Execution)
* **Handled by**: `TelephonyUssdExecutor.kt`
* Android 8.0 introduced `TelephonyManager.sendUssdRequest()`. It executes the command without popping up the dialer UI and intercepts the raw string response directly via an OS callback!
* **Caveat**: It is limited by strict carriers and sometimes struggles with infinitely chained multi-step requests on locked cell towers.

#### Method B: Accessibility Service Engine (UI Scraper & Multi-Step Bot)
* **Handled by**: `UssdAccessibilityService.kt`
* When multi-step sequences fail via method A, the system physically opens the Android Dialer utilizing `Intent.ACTION_CALL`.
* The Accessibility Service catches the `TYPE_WINDOW_STATE_CHANGED` event as the carrier dialog explodes onto the screen.
* It parses the internal Android DOM `AccessibilityNodeInfo` tree to scrape text, locate input `EditText` boxes, inserts the next number securely driven from an `AccessibilityStateManager`, and physically forces an `ACTION_CLICK` on the "Send" DOM node.
* It ultimately clicks "Cancel" / "OK" to dismiss the prompt back into the background.

### 3. Foreground Resilience
Because Android ruthlessly kills idle background tasks to preserve batteries, the `BackgroundUssdService.kt` operates brutally:
* Projects itself as an ongoing **Foreground Service** notification.
* Claims a **WakeLock** to disable the CPU from deep-sleeping during active sessions.
* Relies on `BootReceiver.kt` to bind onto Android's `ACTION_BOOT_COMPLETED` intent—auto-starting the app immediately when power returns after a reboot.

---

## 💻 Working Demonstration Backend

You can't test an IoT network without an orchestrator. We have included a full **Node.js WebSocket + Express Web UI** backend located in the `backend-example/` folder!

### Running the Example Backend
1. Make sure you have [Node.js](https://nodejs.org) installed on your PC.
2. Open a terminal inside `backend-example/`.
3. Install dependencies: `npm install`
4. Start the server: `npm start`
5. Visit **`http://localhost:3000/ui`** on your browser to view the Dark Mode Command Center!

### Connecting your Android Device
1. Install your APK via standard GitHub actions or USB.
2. Under "Backend WebSocket URL", put: `ws://YOUR_LOCAL_IP:3000/ws` *(Ensure device is on the same WiFi!).*
3. Provide an "Authentication Token".
4. Guarantee you press the dynamic deep-link buttons allowing A11y bindings. Tap **Start Foreground Engine**!

---

## 📡 API Contract Specification

When structuring the real backend for production orchestration, replicate these exact footprints.

### 1. Payload Over WebSocket (Server -> Phone)
```json
{
  "execution_id": "req-9812-fast",
  "ussd_code": "*121#",
  "steps": ["1", "5", "1"],
  "timeout": 15000,
  "sim_slot": 1
}
```
* **execution_id**: Unique UUID to identify the callback sequence.
* **sim_slot**: `0` targets SIM1. `1` targets SIM2.
* **steps**: Array of inputs for successive menus. Array length indicates the iterations the AccessibilityService should scrape before finalizing.

### 2. Device Response (Phone -> Server WebSocket)
```json
{
  "execution_id": "req-9812-fast",
  "status": "success",
  "response": "Your account balance is: 450.50 Credits."
}
```

---

## 🛠 Developer Integration Guide

The IoT SIM Manager platform is designed to be fully headless. You can orchestrate USSD sequences and verify payments programmatically using our REST and Webhook APIs.

### 1. Triggering USSD Sequences
Execute sequential carrier commands (e.g., Send Money, Buy Data) directly from your backend.

**Endpoint**: `POST /api/trigger`
**Auth**: `Authorization: Bearer <YOUR_API_KEY>`

```json
{
  "device_id": "node_7fb12", 
  "ussd_code": "*247#",
  "steps": ["1", "017xxxxxxxx", "500", "1234"],
  "variables": {
    "RECIPIENT": "017xxxxxxxx",
    "AMOUNT": "500"
  }
}
```

### 2. Payment Verification API
Automate payment reconciliation by checking user-submitted transaction IDs against real-time gateway logs.

**Endpoint**: `POST /api/verify`

```json
{
  "trx_id": "8JANX9B2",
  "amount": "1200.00"
}
```
**Response**: `200 OK` if the payment is valid and unclaimed.

### 3. Real-time Webhooks
Configured extraction rules automatically reach out to your external servers when a carrier message matches your regex logic.

**Protocol**: HTTP POST (JSON)
**Custom Header**: `X-Gateway-Event: payment.captured`

```json
{
  "internal_id": "pay_981273x",
  "status": "SUCCESS",
  "method": "bkash",
  "amount": "1200.00",
  "trx_id": "9BJS92LK",
  "sender": "017xxxxxxxx",
  "timestamp": 1712839210000
}
```

---

## 🚧 Roadmap & Future Scaling Architecture
...
