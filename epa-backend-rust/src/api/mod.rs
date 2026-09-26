use axum::{
    extract::{State},
    Json, response::IntoResponse,
    http::StatusCode,
};
use serde_json::{json, Value};
use crate::gateway::{GatewayState};
use crate::models::{PaymentMethod, UssdScript, TriggerRequest};
use crate::auth::{AuthUser, create_jwt};
use axum::extract::ws::Message;
use std::sync::Arc;
use mongodb::bson::doc;

#[derive(serde::Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

pub async fn login(Json(req): Json<LoginRequest>) -> impl IntoResponse {
    // Standard Production Check (replace with DB lookup for multi-user)
    if req.username == "admin" && req.password == "admin123" {
        let token = create_jwt(&req.username);
        (StatusCode::OK, Json(json!({ "token": token })))
    } else {
        (StatusCode::UNAUTHORIZED, Json(json!({ "error": "INVALID_CREDENTIALS" })))
    }
}

pub async fn list_devices(_auth: AuthUser, State(state): State<Arc<GatewayState>>) -> impl IntoResponse {
    let mut devs = Vec::new();
    for dev in state.devices.iter() {
        devs.push(dev.key().clone());
    }
    Json(json!({ "devices": devs }))
}

pub async fn trigger_script(
    _auth: AuthUser,
    State(state): State<Arc<GatewayState>>,
    Json(req): Json<TriggerRequest>,
) -> impl IntoResponse {
    let mut final_ussd = req.ussd_code.clone().unwrap_or_default();
    let mut final_steps = req.steps.clone().unwrap_or_default();

    // 1. Load from DB if script_id provided
    if let Some(sid) = req.script_id {
        let coll = state.db.db.collection::<UssdScript>("ussd_scripts");
        if let Ok(Some(s)) = coll.find_one(doc! { "_id": sid }).await {
            final_ussd = s.ussd_code;
            final_steps = s.steps;
        }
    }

    // 2. Perform Variable Injection
    if let Some(vars) = req.variables {
        for (k, v) in vars {
            let placeholder = format!("{{{{{}}}}}", k);
            final_ussd = final_ussd.replace(&placeholder, &v);
            for step in final_steps.iter_mut() {
                *step = step.replace(&placeholder, &v);
            }
        }
    }

    // 3. Dispatch to device
    if let Some(tx) = state.devices.get(&req.device_id) {
        let execution_id = format!("exec_{}", chrono::Utc::now().timestamp_millis());
        let payload = json!({
            "execution_id": execution_id,
            "ussd_code": final_ussd,
            "steps": final_steps,
            "timeout": 20000
        });

        if let Ok(msg) = serde_json::to_string(&payload) {
            let _ = tx.send(Message::Text(msg));
            return (StatusCode::OK, Json(json!({ "status": "SUCCESS", "execution_id": execution_id })));
        }
    }

    (StatusCode::NOT_FOUND, Json(json!({ "status": "ERROR", "message": "DEVICE_OFFLINE" })))
}


pub async fn get_payments(_auth: AuthUser, State(state): State<Arc<GatewayState>>) -> impl IntoResponse {
    let coll = state.db.db.collection::<Value>("payments");
    let mut cursor = coll.find(doc! {}).await.unwrap();
    let mut payments = Vec::new();
    while let Some(p) = futures_util::stream::StreamExt::next(&mut cursor).await {
        payments.push(p.unwrap());
    }
    Json(payments)
}

pub async fn add_method(
    _auth: AuthUser,
    State(state): State<Arc<GatewayState>>,
    Json(method): Json<PaymentMethod>,
) -> impl IntoResponse {
    let coll = state.db.db.collection::<PaymentMethod>("payment_methods");
    
    // Perform Upsert based on identifier
    let filter = doc! { "identifier": &method.identifier };
    
    let bson_data = match mongodb::bson::to_bson(&method) {
        Ok(b) => b,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Serialization failed: {}", e)}))).into_response(),
    };
    
    let update = doc! { "$set": bson_data };
    
    if let Err(e) = coll.update_one(filter, update).upsert(true).await {
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Database update failed: {}", e)}))).into_response();
    }
    
    let _ = state.db.refresh_methods().await;
    StatusCode::CREATED.into_response()
}

#[derive(serde::Deserialize)]
pub struct VerifyRequest {
    pub trx_id: Option<String>,
    pub sender_suffix: Option<String>,
    pub amount: String,
}

pub async fn verify_payment(
    _auth: AuthUser,
    State(state): State<Arc<GatewayState>>,
    Json(req): Json<VerifyRequest>,
) -> impl IntoResponse {
    match state.db.verify_and_claim_payment(req.trx_id, req.sender_suffix, req.amount).await {
        Ok(Some(payment)) => (StatusCode::OK, Json(json!({ "status": "SUCCESS", "payment": payment }))).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, Json(json!({ "status": "FAILED", "message": "REJECT_NOT_FOUND: No unused matching payment." }))).into_response(),
        Err(e) if e.contains("REJECT_UNDERPAID") => (StatusCode::BAD_REQUEST, Json(json!({ "status": "FAILED", "message": e }))).into_response(),
        Err(e) if e.contains("REJECT_AMBIGUOUS") => (StatusCode::BAD_REQUEST, Json(json!({ "status": "FAILED", "message": e }))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "ERROR", "message": e }))).into_response(),
    }
}


pub async fn save_script(
    _auth: AuthUser,
    State(state): State<Arc<GatewayState>>,
    Json(mut script): Json<UssdScript>,
) -> impl IntoResponse {
    let coll = state.db.db.collection::<UssdScript>("ussd_scripts");
    
    if let Some(id) = script.id {
        coll.replace_one(doc! { "_id": id }, script).await.unwrap();
        StatusCode::OK
    } else {
        script.id = Some(mongodb::bson::oid::ObjectId::new());
        coll.insert_one(script).await.unwrap();
        StatusCode::CREATED
    }
}

pub async fn list_scripts(_auth: AuthUser, State(state): State<Arc<GatewayState>>) -> impl IntoResponse {
    let coll = state.db.db.collection::<UssdScript>("ussd_scripts");
    let mut cursor = coll.find(doc! {}).await.unwrap();
    let mut scripts = Vec::new();
    while let Some(s) = futures_util::stream::StreamExt::next(&mut cursor).await {
        scripts.push(s.unwrap());
    }
    Json(scripts)
}

pub async fn delete_script(
    _auth: AuthUser,
    axum::extract::Path(id): axum::extract::Path<String>,
    State(state): State<Arc<GatewayState>>,
) -> impl IntoResponse {
    if let Ok(oid) = mongodb::bson::oid::ObjectId::parse_str(&id) {
        let coll = state.db.db.collection::<UssdScript>("ussd_scripts");
        if let Ok(res) = coll.delete_one(doc! { "_id": oid }).await {
            if res.deleted_count > 0 {
                return StatusCode::OK;
            }
        }
    }
    StatusCode::NOT_FOUND
}

pub async fn get_ussd_history(_auth: AuthUser, State(state): State<Arc<GatewayState>>) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    let coll = state.db.db.collection::<Value>("ussd_logs");
    
    let find_options = mongodb::options::FindOptions::builder()
        .sort(doc! { "_id": -1 })
        .limit(100)
        .build();

    let mut cursor = coll.find(doc! {}).with_options(find_options).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    let mut history = Vec::new();
    while let Some(res) = futures_util::stream::StreamExt::next(&mut cursor).await {
        match res {
            Ok(h) => history.push(h),
            Err(e) => return Err((StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))),
        }
    }
    Ok(Json(history))
}

pub async fn get_methods(_auth: AuthUser, State(state): State<Arc<GatewayState>>) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    let coll = state.db.db.collection::<PaymentMethod>("payment_methods");
    let mut cursor = coll.find(doc! {}).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;

    let mut methods = Vec::new();
    while let Some(res) = futures_util::stream::StreamExt::next(&mut cursor).await {
        match res {
            Ok(m) => methods.push(m),
            Err(e) => return Err((StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))),
        }
    }
    Ok(Json(methods))
}

pub async fn delete_method(
    _auth: AuthUser,
    axum::extract::Path(identifier): axum::extract::Path<String>,
    State(state): State<Arc<GatewayState>>,
) -> impl IntoResponse {
    let coll = state.db.db.collection::<PaymentMethod>("payment_methods");
    if let Ok(res) = coll.delete_one(doc! { "identifier": identifier }).await {
        if res.deleted_count > 0 {
            let _ = state.db.refresh_methods().await;
            return StatusCode::OK;
        }
    }
    StatusCode::NOT_FOUND
}

pub async fn get_credentials(_auth: AuthUser, State(_state): State<Arc<GatewayState>>) -> impl IntoResponse {
    // In production, this would resolve from the API key registry in the database
    Json(json!({ "apiKey": "ek_live_8f3d2a1b9e0c7f6e5d4c3b2a1" }))
}
