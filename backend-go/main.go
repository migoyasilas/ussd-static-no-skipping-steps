package main

import (
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"math/rand"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

//go:embed public/*
var content embed.FS

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all for demo
	},
}

// Thread-safe map for connected Android devices
var connectedDevices = struct {
	sync.RWMutex
	m map[string]*websocket.Conn
}{m: make(map[string]*websocket.Conn)}

// Thread-safe map for UI Dashboards
var dashboardClients = struct {
	sync.RWMutex
	m map[*websocket.Conn]bool
}{m: make(map[*websocket.Conn]bool)}

// Per-device SIM info (sent by Android app on connect)
var deviceSimInfo = struct {
	sync.RWMutex
	m map[string]interface{}
}{m: make(map[string]interface{})}

type TriggerPayload struct {
	Device          string   `json:"device"`
	UssdCode        string   `json:"ussd_code"`
	Steps           []string `json:"steps"`
	Timeout         int      `json:"timeout"`
	SimSlot         *int     `json:"sim_slot"`
	GracePeriodMs   *int64   `json:"grace_period_ms"`
	StepCooldownMs  *int64   `json:"step_cooldown_ms"`
	StepInputDelayMs *int64  `json:"step_input_delay_ms"`
	Tier2TimeoutMs  *int64   `json:"tier2_timeout_ms"`
}

type DevicePayload struct {
	ExecutionID      string   `json:"execution_id"`
	UssdCode         string   `json:"ussd_code"`
	Steps            []string `json:"steps"`
	Timeout          int      `json:"timeout"`
	SimSlot          *int     `json:"sim_slot"`
	GracePeriodMs    *int64   `json:"grace_period_ms,omitempty"`
	StepCooldownMs   *int64   `json:"step_cooldown_ms,omitempty"`
	StepInputDelayMs *int64   `json:"step_input_delay_ms,omitempty"`
	Tier2TimeoutMs   *int64   `json:"tier2_timeout_ms,omitempty"`
}

func main() {
	// Serve embedded static files
	publicFS, err := fs.Sub(content, "public")
	if err != nil {
		log.Fatal(err)
	}
	http.Handle("/", http.FileServer(http.FS(publicFS)))

	// API Routes
	http.HandleFunc("/ws", handleDeviceWS)
	http.HandleFunc("/ui", handleDashboardWS)
	http.HandleFunc("/api/trigger", handleTrigger)
	http.HandleFunc("/api/devices", handleGetDevices)
	http.HandleFunc("/api/ussd/response", handleRestFallback)

	// Print available local IPs
	printLocalIPs()

	log.Println("🚀 Eksses Payment api {EPA} listening on http://0.0.0.0:3000")
	log.Fatal(http.ListenAndServe("0.0.0.0:3000", nil))
}

func handleDeviceWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Device WS Upgrade error:", err)
		return
	}

	auth := r.Header.Get("Authorization")
	if auth == "" {
		// Mock token if not provided
		auth = fmt.Sprintf("Unknown-%04x", rand.Intn(0xffff))
	}
	val := strings.ReplaceAll(auth, "Bearer ", "")

	connectedDevices.Lock()
	connectedDevices.m[val] = conn
	connectedDevices.Unlock()

	log.Printf("[+] Device connected: %s\n", val)
	broadcastToDashboards(map[string]interface{}{
		"type":   "DEVICE_STATUS",
		"device": val,
		"status": "CONNECTED",
	})

	defer func() {
		connectedDevices.Lock()
		delete(connectedDevices.m, val)
		connectedDevices.Unlock()
		conn.Close()
		log.Printf("[-] Device disconnected: %s\n", val)
		broadcastToDashboards(map[string]interface{}{
			"type":   "DEVICE_STATUS",
			"device": val,
			"status": "DISCONNECTED",
		})
	}()

	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			break
		}

		var rawMap map[string]interface{}
		if jsonErr := json.Unmarshal(msg, &rawMap); jsonErr != nil {
			// Not JSON — log raw
			log.Printf("[RAW] %s: %s\n", val, string(msg))
			continue
		}

		// ── DEVICE_SMS ──────────────────────────────────────
		if rawMap["type"] == "DEVICE_SMS" {
			rawMap["device"] = val
			log.Printf("[📬 SMS] Device=%s From=%v: %v\n", val, rawMap["sender"], rawMap["body"])
			broadcastToDashboards(rawMap)
			continue
		}

		// ── DEVICE_INFO (SIM list) ───────────────────────────
		if rawMap["type"] == "DEVICE_INFO" {
			deviceSimInfo.Lock()
			deviceSimInfo.m[val] = rawMap["sims"]
			deviceSimInfo.Unlock()
			log.Printf("[SIM] Device=%s SIMs=%v\n", val, rawMap["sims"])
			broadcastToDashboards(map[string]interface{}{
				"type":   "DEVICE_SIMS",
				"device": val,
				"sims":   rawMap["sims"],
			})
			continue
		}

		// ── USSD RESPONSE (execution_id + status + response) ─
		execID, hasExecID := rawMap["execution_id"].(string)
		status, hasStatus := rawMap["status"].(string)
		response, _ := rawMap["response"].(string)

		if hasExecID && hasStatus {
			// Rich console logging by status tier
			switch status {
			case "success", "success_forced":
				log.Printf("[✅ USSD OK] Device=%s ID=%s\n  Response: %s\n", val, execID, response)
			case "info", "live_menu":
				log.Printf("[ℹ️  INFO] Device=%s ID=%s: %s\n", val, execID, response)
			case "warning":
				log.Printf("[⚠️  WARN] Device=%s ID=%s: %s\n", val, execID, response)
			case "timeout":
				log.Printf("[⏱ TIMEOUT] Device=%s ID=%s: %s\n", val, execID, response)
			case "failed", "error":
				log.Printf("[❌ FAIL] Device=%s ID=%s: %s\n", val, execID, response)
			case "heartbeat":
				log.Printf("[💓 HEARTBEAT] Device=%s: %s\n", val, response)
				// Don't broadcast heartbeats to dashboard — they are noise
				continue
			default:
				log.Printf("[?] Device=%s ID=%s status=%s: %s\n", val, execID, status, response)
			}

			broadcastToDashboards(map[string]interface{}{
				"type":         "USSD_RESULT",
				"device":       val,
				"execution_id": execID,
				"status":       status,
				"response":     response,
			})
			continue
		}

		// ── DEVICE_LOG (phone console forwarded to backend) ───
		if msgType, ok := rawMap["type"].(string); ok && msgType == "DEVICE_LOG" {
			logMsg, _ := rawMap["message"].(string)
			log.Printf("[📱 PHONE LOG] Device=%s: %s\n", val, logMsg)
			broadcastToDashboards(map[string]interface{}{
				"type":    "PHONE_LOG",
				"device":  val,
				"message": logMsg,
			})
			continue
		}

		// ── Fallback: unknown JSON ────────────────────────────
		log.Printf("[?] Device=%s unknown msg: %s\n", val, string(msg))
		broadcastToDashboards(map[string]interface{}{
			"type":    "DEVICE_MSG",
			"device":  val,
			"payload": string(msg),
		})
	}

}

func handleDashboardWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	dashboardClients.Lock()
	dashboardClients.m[conn] = true
	dashboardClients.Unlock()
	log.Println("UI Dashboard Connected.")
	
	broadcastToDashboards(map[string]interface{}{
		"type":    "LOG",
		"message": "Dashboard connected to server.",
	})

	defer func() {
		dashboardClients.Lock()
		delete(dashboardClients.m, conn)
		dashboardClients.Unlock()
		conn.Close()
	}()

	// Keep alive reader
	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			break
		}
	}
}

func handleTrigger(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var p TriggerPayload
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	connectedDevices.RLock()
	targetWs, exists := connectedDevices.m[p.Device]
	connectedDevices.RUnlock()

	if !exists {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "Device not found or offline"})
		return
	}

	execID := fmt.Sprintf("exec_%d", time.Now().UnixMilli())
	if p.Timeout == 0 {
		p.Timeout = 15000
	}
	if p.Steps == nil {
		p.Steps = []string{}
	}

	outPayload := DevicePayload{
		ExecutionID:      execID,
		UssdCode:         p.UssdCode,
		Steps:            p.Steps,
		Timeout:          p.Timeout,
		SimSlot:          p.SimSlot,
		GracePeriodMs:    p.GracePeriodMs,
		StepCooldownMs:   p.StepCooldownMs,
		StepInputDelayMs: p.StepInputDelayMs,
		Tier2TimeoutMs:   p.Tier2TimeoutMs,
	}

	b, _ := json.Marshal(outPayload)
	err := targetWs.WriteMessage(websocket.TextMessage, b)
	
	log.Printf("[->] Sending payload to Android Device (%s):\n%s\n", p.Device, string(b))
	
	if err != nil {
		http.Error(w, "Failed to send to device", http.StatusInternalServerError)
		return
	}

	broadcastToDashboards(map[string]interface{}{
		"type":    "LOG",
		"message": fmt.Sprintf("Sent payload to %s: %s", p.Device, string(b)),
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"payload": outPayload,
	})
}

func handleGetDevices(w http.ResponseWriter, r *http.Request) {
	connectedDevices.RLock()
	var devs []string
	for k := range connectedDevices.m {
		devs = append(devs, k)
	}
	connectedDevices.RUnlock()

	// Also include SIM info per device
	deviceSimInfo.RLock()
	devSimsCopy := make(map[string]interface{})
	for k, v := range deviceSimInfo.m {
		devSimsCopy[k] = v
	}
	deviceSimInfo.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"devices": devs, "sims": devSimsCopy})
}

func handleRestFallback(w http.ResponseWriter, r *http.Request) {
	var body interface{}
	json.NewDecoder(r.Body).Decode(&body)
	log.Printf("[REST] Persistent fallback payload received: %+v\n", body)
	
	broadcastToDashboards(map[string]interface{}{
		"type":    "REST_MSG",
		"payload": body,
	})
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

func broadcastToDashboards(data map[string]interface{}) {
	b, _ := json.Marshal(data)
	dashboardClients.RLock()
	for conn := range dashboardClients.m {
		conn.WriteMessage(websocket.TextMessage, b)
	}
	dashboardClients.RUnlock()
}

func printLocalIPs() {
	ifaces, err := net.Interfaces()
	if err != nil {
		return
	}
	log.Println("📱 Type this on your Android URL: ws://<YOUR_LOCAL_WIFI_IP>:3000/ws")
	for _, i := range ifaces {
		addrs, err := i.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			var ip net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			}
			if ip != nil && ip.To4() != nil && !ip.IsLoopback() {
				log.Printf("   -> Target IP over WiFi: ws://%s:3000/ws\n", ip.String())
			}
		}
	}
}
