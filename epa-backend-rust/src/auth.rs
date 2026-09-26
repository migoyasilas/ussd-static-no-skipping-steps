use axum::{
    async_trait,
    extract::{FromRequestParts},
    http::{request::Parts, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::OnceLock;

pub fn get_jwt_secret() -> &'static [u8] {
    static SECRET: OnceLock<Vec<u8>> = OnceLock::new();
    SECRET.get_or_init(|| {
        std::env::var("JWT_SECRET")
            .unwrap_or_else(|_| "eksses_enterprise_secret_2026".to_string())
            .into_bytes()
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
}

pub fn create_jwt(uid: &str) -> String {
    let expiration = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::days(7))
        .expect("valid timestamp")
        .timestamp();

    let claims = Claims {
        sub: uid.to_owned(),
        exp: expiration as usize,
    };

    encode(&Header::default(), &claims, &EncodingKey::from_secret(get_jwt_secret())).unwrap()
}

pub struct AuthUser(pub String);

#[async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = Response;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        // 1. Check for API Key (ek_live_...)
        if let Some(auth_header) = parts.headers.get("X-API-Key") {
            if let Ok(key) = auth_header.to_str() {
                if key.starts_with("ek_live_") {
                    // In a full implementation, we'd verify this against the DB
                    return Ok(AuthUser("merchant_api".to_string()));
                }
            }
        }

        // 2. Check for JWT (Bearer token)
        let auth_header = parts.headers.get("Authorization")
            .and_then(|h| h.to_str().ok())
            .filter(|h| h.starts_with("Bearer "));

        if let Some(token) = auth_header {
            let token = &token[7..];
            let validation = Validation::default();
            match decode::<Claims>(token, &DecodingKey::from_secret(get_jwt_secret()), &validation) {
                Ok(data) => return Ok(AuthUser(data.claims.sub)),
                Err(_) => (),
            }
        }

        Err((StatusCode::UNAUTHORIZED, Json(json!({ "error": "UNAUTHORIZED_SESSIONS" }))).into_response())
    }
}
