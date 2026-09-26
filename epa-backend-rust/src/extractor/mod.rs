use crate::models::{Payment, PaymentMethod};
use regex::Regex;
use uuid::Uuid;
use chrono::Utc;

pub fn extract_payment(raw_text: &str, device_id: &str, method: &PaymentMethod) -> Option<Payment> {
    // ... existing logic ...
    let mut extracted_fields = std::collections::HashMap::new();
    let mut match_found = false;

    for extractor in &method.extractors {
        if let Ok(re) = Regex::new(&extractor.regex) {
            if let Some(caps) = re.captures(raw_text) {
                if let Some(mat) = caps.get(extractor.group_index as usize) {
                    extracted_fields.insert(extractor.field_name.clone(), mat.as_str().to_string());
                    match_found = true;
                }
            }
        }
    }

    if !match_found {
        return None;
    }

    let amount = extracted_fields.get("amount").cloned().unwrap_or_else(|| "0.00".to_string());
    let trx_id = extracted_fields.get("trx_id").cloned();
    let sender = extracted_fields.get("sender").cloned().unwrap_or_else(|| "UNKNOWN".to_string());
    let category = extracted_fields.get("category").cloned().unwrap_or_else(|| "UNKNOWN".to_string());

    let payment = Payment {
        id: None,
        internal_id: Uuid::new_v4().to_string(),
        trx_id,
        amount,
        sender,
        category,
        fee: None,
        balance: None,
        method: method.identifier.clone(),
        status: "UNUSED".to_string(),
        raw_log: raw_text.to_string(),
        device_id: device_id.to_string(),
        timestamp: Utc::now().timestamp(),
    };

    // Fire-and-forget Webhook if configured
    if let Some(url) = &method.webhook_url {
        let client = reqwest::Client::new();
        let payload = payment.clone();
        let target_url = url.clone();
        tokio::spawn(async move {
            let _ = client.post(target_url).json(&payload).send().await;
        });
    }

    Some(payment)
}

pub fn extract_success_report(raw_text: &str) -> (Option<String>, Option<String>, Option<String>) {
    let mut trx_id = None;
    let mut fee = None;
    let mut balance = None;

    // TrxID: DDC53KQED9
    if let Ok(re) = Regex::new(r"TrxID\s+([A-Z0-9]+)") {
        if let Some(caps) = re.captures(raw_text) {
            trx_id = caps.get(1).map(|m| m.as_str().to_string());
        }
    }

    // Fee: Tk 10.00 or Tk 0.00
    if let Ok(re) = Regex::new(r"Fee\s+Tk\s+([\d,.]+)") {
        if let Some(caps) = re.captures(raw_text) {
            fee = caps.get(1).map(|m| m.as_str().to_string());
        }
    }

    // Balance: Tk 1500.00
    if let Ok(re) = Regex::new(r"Balance\s+Tk\s+([\d,.]+)") {
        if let Some(caps) = re.captures(raw_text) {
            balance = caps.get(1).map(|m| m.as_str().to_string());
        }
    }

    (trx_id, fee, balance)
}

