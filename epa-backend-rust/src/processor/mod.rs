use regex::Regex;
use crate::models::{Payment, PaymentMethod};

pub struct PaymentProcessor;

impl PaymentProcessor {
    pub fn try_parse(body: &str, method: &PaymentMethod, re: &Regex, device_id: &str) -> Option<Payment> {
        if let Some(caps) = re.captures(body) {
            let amount = caps.name("amount").map(|m| m.as_str().to_string()).unwrap_or_default();
            let txn_id = caps.name("txn_id").map(|m| m.as_str().to_string()).unwrap_or_else(|| {
                // Fallback: search for TxnID if not in named group
                Regex::new(r"TxnID:\s*([A-Z0-9]+)").ok()
                    .and_then(|fallback_re| fallback_re.captures(body))
                    .and_then(|c| c.get(1))
                    .map(|m| m.as_str().to_string())
                    .unwrap_or_else(|| format!("UNKNOWN_{}", uuid::Uuid::new_v4()))
            });
            let sender = caps.name("sender").map(|m| m.as_str().to_string()).unwrap_or_default();

            return Some(Payment {
                id: None,
                txn_id,
                amount,
                sender,
                method: method.name.clone(),
                status: "RECEIVED".to_string(),
                timestamp: chrono::Utc::now().timestamp_millis(),
                device_id: device_id.to_string(),
            });
        }
        None
    }
}
