use serde::{Deserialize, Serialize};
use mongodb::bson::oid::ObjectId;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DeviceInfo {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub device_id: String,
    pub status: String,
    pub last_seen: i64,
    pub sims: Vec<SimInfo>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SimInfo {
    pub slot: i32,
    pub carrier: String,
    pub number: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UssdRequest {
    pub execution_id: String,
    pub ussd_code: String,
    pub steps: Vec<String>,
    pub timeout: Option<i64>,
    pub sim_slot: Option<i32>,
    pub grace_period_ms: Option<i64>,
    pub step_cooldown_ms: Option<i64>,
    pub step_input_delay_ms: Option<i64>,
    pub tier2_timeout_ms: Option<i64>,
    pub settling_delay_ms: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TriggerRequest {
    pub device_id: String,
    pub script_id: Option<ObjectId>,
    pub ussd_code: Option<String>,
    pub steps: Option<Vec<String>>,
    pub variables: Option<std::collections::HashMap<String, String>>,
    pub settling_delay_ms: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UssdResponse {
    pub execution_id: String,
    pub status: String,
    pub response: String,
    #[serde(skip_deserializing)]
    pub device_id: Option<String>,
    #[serde(skip_deserializing)]
    pub timestamp: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SmsLog {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub device_id: String,
    pub sender: String,
    pub body: String,
    pub timestamp: i64,
    pub is_payment: bool,
    pub payment_id: Option<ObjectId>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Extractor {
    pub field_name: String, // e.g. "amount", "trx_id", "sender"
    pub regex: String,
    pub group_index: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PaymentMethod {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub name: String,
    pub identifier: String, // "bkash", "nagad"
    pub extractors: Vec<Extractor>,
    pub webhook_url: Option<String>,
    pub active: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UssdScript {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub name: String,
    pub ussd_code: String,
    pub steps: Vec<String>,
    pub success_pattern: Option<String>, // Regex to mark as SUCCESS
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Payment {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub internal_id: String,
    pub trx_id: Option<String>,
    pub amount: String,
    pub sender: String,
    pub category: String, // "CREDIT" (In), "DEBIT" (Out)
    pub method: String, // "bkash", "nagad"
    pub status: String, // "PENDING", "SUCCESS", "FAILED"
    pub raw_log: String,
    pub device_id: String,
    pub timestamp: i64,
    pub fee: Option<String>,
    pub balance: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct User {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub username: String,
    pub password_hash: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ApiKey {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub key: String, // ek_live_...
    pub name: String,
    pub created_at: i64,
}

