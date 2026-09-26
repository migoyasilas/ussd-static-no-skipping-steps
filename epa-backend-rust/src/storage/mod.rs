use mongodb::{Client, Database, Collection};
use mongodb::bson::{doc};
use crate::models::{DeviceInfo, SmsLog, UssdResponse, PaymentMethod, Payment};
use std::sync::Arc;
use tokio::sync::RwLock;

pub struct DbState {
    pub db: Database,
    pub methods: Arc<RwLock<Vec<PaymentMethod>>>,
}

impl DbState {
    pub async fn new(uri: &str) -> mongodb::error::Result<Self> {
        let client = Client::with_uri_str(uri).await?;
        let db = client.database("epa");
        
        let state = Self {
            db,
            methods: Arc::new(RwLock::new(Vec::new())),
        };
        
        state.refresh_methods().await?;
        Ok(state)
    }

    pub async fn refresh_methods(&self) -> mongodb::error::Result<()> {
        let coll: Collection<PaymentMethod> = self.db.collection("payment_methods");
        let mut cursor = coll.find(doc! {}).await?;
        let mut new_methods = Vec::new();
        
        while let Some(method) = futures_util::stream::StreamExt::next(&mut cursor).await {
            new_methods.push(method?);
        }
        
        let mut lock = self.methods.write().await;
        *lock = new_methods;
        Ok(())
    }

    pub async fn seed_defaults(&self) -> mongodb::error::Result<()> {
        let script_coll: Collection<crate::models::UssdScript> = self.db.collection("ussd_scripts");
        let count = script_coll.count_documents(doc! { "name": "bKash Enterprise Send" }).await?;
        
        if count == 0 {
            let default_script = crate::models::UssdScript {
                id: Some(mongodb::bson::oid::ObjectId::new()),
                name: "bKash Enterprise Send".to_string(),
                ussd_code: "*247#".to_string(),
                steps: vec![
                    "1".to_string(),            // Send Money
                    "{{RECIPIENT}}".to_string(), // To: Number
                    "{{AMOUNT}}".to_string(),    // Amount: Tk
                    "{{REFERENCE}}".to_string(), // Ref: Text
                    "{{PIN}}".to_string(),       // PIN: Number
                ],
                success_pattern: Some("successful".to_string()),
            };
            script_coll.insert_one(default_script).await?;
            tracing::info!("SEED: bKash Enterprise Workflow Initialized");
        }

        let method_coll: Collection<crate::models::PaymentMethod> = self.db.collection("payment_methods");
        let m_count = method_coll.count_documents(doc! { "identifier": "bkash" }).await?;
        if m_count == 0 {
            let default_method = crate::models::PaymentMethod {
                id: Some(mongodb::bson::oid::ObjectId::new()),
                name: "bKash Logic".to_string(),
                identifier: "bkash".to_string(),
                extractors: vec![
                    crate::models::Extractor { field_name: "amount".to_string(), regex: "Tk ([\\d\\.]+)".to_string(), group_index: 1 },
                    crate::models::Extractor { field_name: "trx_id".to_string(), regex: "TrxID ([A-Z0-9]+)".to_string(), group_index: 1 },
                    crate::models::Extractor { field_name: "sender".to_string(), regex: "from ([0-9]+)".to_string(), group_index: 1 },
                ],
                webhook_url: Some("".to_string()),
                active: true,
            };
            method_coll.insert_one(default_method).await?;
            tracing::info!("SEED: bKash Extraction Logic Initialized");
        }
        Ok(())
    }


    pub async fn save_device_info(&self, info: DeviceInfo) -> mongodb::error::Result<()> {
        let coll: Collection<DeviceInfo> = self.db.collection("devices");
        let filter = doc! { "device_id": &info.device_id };
        let update = doc! { "$set": mongodb::bson::to_bson(&info)? };
        if let Err(e) = coll.update_one(filter, update).upsert(true).await {
            tracing::error!("Failed to save device info: {}", e);
            return Err(e);
        }
        Ok(())
    }

    pub async fn log_sms(&self, log: SmsLog) -> mongodb::error::Result<()> {
        let coll = self.db.collection("sms_logs");
        coll.insert_one(log).await?;
        Ok(())
    }

    pub async fn log_ussd(&self, resp: UssdResponse) -> mongodb::error::Result<()> {
        let coll = self.db.collection("ussd_logs");
        coll.insert_one(resp).await?;
        Ok(())
    }

    pub async fn save_payment(&self, payment: Payment) -> mongodb::error::Result<()> {
        let coll = self.db.collection("payments");
        coll.insert_one(payment).await?;
        Ok(())
    }

    pub async fn verify_and_claim_payment(&self, trx_id: Option<String>, sender_suffix: Option<String>, required_amount: String) -> Result<Option<Payment>, String> {
        if trx_id.is_none() && sender_suffix.is_none() {
            return Err("REJECT_AMBIGUOUS: TRX_ID or Sender Suffix required".to_string());
        }

        let coll: Collection<Payment> = self.db.collection("payments");
        
        let mut filter = doc! {
            "status": "UNUSED",
            "timestamp": { "$gt": chrono::Utc::now().timestamp() - (2 * 24 * 60 * 60) }
        };

        if let Some(tid) = trx_id {
            filter.insert("trx_id", tid);
        }

        if let Some(suffix) = sender_suffix {
            filter.insert("sender", doc! { "$regex": format!("{}$", suffix) });
        }

        // 1. Find the payment first to check amount
        let payment = match coll.find_one(filter.clone()).await {
            Ok(Some(p)) => p,
            _ => return Ok(None),
        };

        // 2. Amount Logic: actual >= required
        let actual_f: f64 = payment.amount.parse().unwrap_or(0.0);
        let required_f: f64 = required_amount.parse().unwrap_or(0.0);

        if actual_f < required_f {
            return Err(format!("REJECT_UNDERPAID: Received {} but required {}", actual_f, required_f));
        }

        // 3. Atomic update status to SUCCESS
        let update = doc! { "$set": { "status": "SUCCESS" } };
        let result = coll.find_one_and_update(filter, update).await.map_err(|e| e.to_string())?;
        
        Ok(result)
    }
}


