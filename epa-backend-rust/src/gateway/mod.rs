use axum::{
    extract::{ws::{Message, WebSocket, WebSocketUpgrade}, State},
    response::IntoResponse,
};
use futures_util::{sink::SinkExt, stream::StreamExt};
use std::sync::Arc;
use dashmap::DashMap;
use tokio::sync::mpsc;
use crate::models::{DeviceInfo, SmsLog, UssdResponse, Payment};
use crate::storage::DbState;
use crate::extractor;

pub type ConnectionMap = Arc<DashMap<String, mpsc::UnboundedSender<Message>>>;

pub struct GatewayState {
    pub devices: ConnectionMap,
    pub ui_connections: ConnectionMap,
    pub db: Arc<DbState>,
}

pub async fn device_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<GatewayState>>,
    headers: axum::http::HeaderMap,
) -> impl IntoResponse {
    let device_id = headers.get("Authorization")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.replace("Bearer ", ""))
        .unwrap_or_else(|| format!("unknown-{}", uuid::Uuid::new_v4()));

    println!("[+] Device connecting: {}", device_id);
    ws.on_upgrade(move |socket| handle_device_socket(socket, state, device_id))
}

pub async fn ui_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<GatewayState>>,
) -> impl IntoResponse {
    let ui_id = format!("ui-{}", uuid::Uuid::new_v4());
    println!("[+] UI Dashboard connecting: {}", ui_id);
    ws.on_upgrade(move |socket| handle_ui_socket(socket, state, ui_id))
}

async fn handle_device_socket(socket: WebSocket, state: Arc<GatewayState>, device_id: String) {
    let (mut sender, mut receiver) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();

    state.devices.insert(device_id.clone(), tx);
    
    // Broadcast ONLINE status to UI
    let online_msg = Message::Text(format!(r#"{{"type":"DEVICE_ONLINE","device_id":"{}"}}"#, device_id));
    for ui in state.ui_connections.iter() {
        let _ = ui.value().send(online_msg.clone());
    }

    // Task to forward messages from internal channel to WebSocket
    let mut send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if sender.send(msg).await.is_err() {
                break;
            }
        }
    });

    // Task to process incoming messages from device
    let cloned_state = state.clone();
    let cloned_id = device_id.clone();
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            if let Message::Text(text) = msg {
                process_device_message(&cloned_state, &cloned_id, &text).await;
            }
        }
    });

    // Wait for either task to finish
    tokio::select! {
        _ = (&mut send_task) => recv_task.abort(),
        _ = (&mut recv_task) => send_task.abort(),
    };

    state.devices.remove(&device_id);
    
    // Broadcast OFFLINE status to UI
    let offline_msg = Message::Text(format!(r#"{{"type":"DEVICE_OFFLINE","device_id":"{}"}}"#, device_id));
    for ui in state.ui_connections.iter() {
        let _ = ui.value().send(offline_msg.clone());
    }
    
    println!("[-] Device disconnected: {}", device_id);
}

async fn handle_ui_socket(socket: WebSocket, state: Arc<GatewayState>, ui_id: String) {
    let (mut sender, mut receiver) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();

    state.ui_connections.insert(ui_id.clone(), tx);

    let mut send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if sender.send(msg).await.is_err() {
                break;
            }
        }
    });

    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(_)) = receiver.next().await {
            // UI doesn't send much yet, just keep alive
        }
    });

    tokio::select! {
        _ = (&mut send_task) => recv_task.abort(),
        _ = (&mut recv_task) => send_task.abort(),
    };

    state.ui_connections.remove(&ui_id);
    println!("[-] UI Dashboard disconnected: {}", ui_id);
}

async fn process_device_message(state: &GatewayState, device_id: &str, text: &str) {
    let json: serde_json::Value = match serde_json::from_str(text) {
        Ok(v) => v,
        Err(_) => return,
    };

    let mut payment_found: Option<Payment> = None;
    let mut webhook_url: Option<String> = None;

    match json["type"].as_str() {
        Some("DEVICE_INFO") => {
            if let Ok(info) = serde_json::from_value::<DeviceInfo>(json) {
                let mut info = info;
                info.device_id = device_id.to_string();
                info.last_seen = chrono::Utc::now().timestamp_millis();
                let _ = state.db.save_device_info(info).await;
            }
        }
        Some("DEVICE_SMS") => {
            if let Ok(mut log) = serde_json::from_value::<SmsLog>(json) {
                log.device_id = device_id.to_string();
                
                let methods = state.db.methods.read().await;
                for method in methods.iter() {
                    if let Some(payment) = extractor::extract_payment(&log.body, device_id, method) {
                        payment_found = Some(payment);
                        webhook_url = method.webhook_url.clone();
                        log.is_payment = true;
                        break;
                    }
                }
                let _ = state.db.log_sms(log).await;
            }
        }
        Some("USSD_RESPONSE") => {
            if let Ok(mut resp) = serde_json::from_value::<UssdResponse>(json) {
                resp.device_id = Some(device_id.to_string());
                resp.timestamp = Some(chrono::Utc::now().timestamp_millis());

                if resp.status == "success" || resp.status == "SUCCESS" {
                    let (trx, fee, bal) = extractor::extract_success_report(&resp.response);
                    
                    let methods = state.db.methods.read().await;
                    if let Some(method) = methods.first() {
                         if let Some(payment) = extractor::extract_payment(&resp.response, device_id, method) {
                             payment_found = Some(Payment {
                                 trx_id: trx.or(payment.trx_id),
                                 fee,
                                 balance: bal,
                                 ..payment
                             });
                             webhook_url = method.webhook_url.clone();
                         }
                    }
                }

                let _ = state.db.log_ussd(resp).await;
            }
        }
        Some("HEARTBEAT") => {
            // Telemery only - no persistent logging
        }
        _ => {}
    }

    // Handled Extracted Payments
    if let Some(payment) = payment_found {
        println!("[+] PAYMENT_EXTRACTED: {} ({} {})", payment.internal_id, payment.method, payment.amount);
        let _ = state.db.save_payment(payment.clone()).await;
        
        // Broadcast Payment Event to Dashboard
        if let Ok(payment_json) = serde_json::to_string(&payment) {
            let msg = Message::Text(format!(r#"{{"type":"PAYMENT_DETECTED","data":{}}}"#, payment_json));
            for ui in state.ui_connections.iter() {
                let _ = ui.value().send(msg.clone());
            }

            // DISPATCH HTTP WEBHOOK
            if let Some(url) = webhook_url {
                if !url.is_empty() {
                    tokio::spawn(async move {
                        let client = reqwest::Client::new();
                        let _ = client.post(&url)
                            .json(&payment)
                            .header("X-Gateway-Event", "payment.captured")
                            .send()
                            .await;
                    });
                }
            }
        }
    }

    // Default Broadcast (Logs/Telemetry)
    let broadcast_msg = Message::Text(text.to_string());
    for ui in state.ui_connections.iter() {
        let _ = ui.value().send(broadcast_msg.clone());
    }
}
