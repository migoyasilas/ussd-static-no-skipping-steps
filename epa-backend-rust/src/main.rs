use std::sync::Arc;
use axum::{
    routing::{get, post, delete},
    Router,
};
use tower_http::cors::CorsLayer;
use dashmap::DashMap;
use clap::Parser;

mod models;
mod storage;
mod gateway;
mod api;
mod extractor;
mod auth;

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Config {
    /// MongoDB connection URI
    #[arg(short, long, env = "DATABASE_URL", default_value = "mongodb://localhost:27017")]
    database_url: String,

    /// Server port
    #[arg(short, long, env = "PORT", default_value_t = 3000)]
    port: u16,

    /// Log level (trace, debug, info, warn, error)
    #[arg(short, long, env = "LOG_LEVEL", default_value = "info")]
    log_level: String,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 1. Load .env file if it exists
    dotenvy::dotenv().ok();

    // 2. Parse configuration (CLI args override environment variables)
    let config = Config::parse();

    // 3. Setup logging with dynamic level
    tracing_subscriber::fmt()
        .with_env_filter(&config.log_level)
        .init();

    // 4. Initialize In-Memory & Persistence State
    let db_state = storage::DbState::new(&config.database_url).await?;
    db_state.seed_defaults().await?; // Add this
    
    let gateway_state = Arc::new(gateway::GatewayState {
        devices: Arc::new(DashMap::new()),
        ui_connections: Arc::new(DashMap::new()),
        db: Arc::new(db_state),
    });

    println!("--------------------------------------------------");
    println!("🚀 EPA Rust Engine v1.1 Starting...");
    println!("📡 Bind Address: 0.0.0.0:{}", config.port);
    println!("📦 Database: {}", config.database_url);
    println!("🛠  Log Level: {}", config.log_level);
    println!("--------------------------------------------------");

    // 5. Build Router
    let app = Router::new()
        // WebSocket Device Gateway
        .route("/ws", get(gateway::device_handler))
        // WebSocket UI/Dashboard Gateway
        .route("/ui", get(gateway::ui_handler))
        
        // Admin & External REST API
        .route("/api/login", post(api::login))
        .route("/api/devices", get(api::list_devices))
        .route("/api/payments", get(api::get_payments))
        .route("/api/methods", get(api::get_methods).post(api::add_method))
        .route("/api/methods/:identifier", delete(api::delete_method))
        .route("/api/scripts", get(api::list_scripts).post(api::save_script))
        .route("/api/scripts/:id", delete(api::delete_script))
        .route("/api/trigger", post(api::trigger_script))
        .route("/api/verify", post(api::verify_payment))
        .route("/api/credentials", get(api::get_credentials))
        .route("/api/ussd/history", get(api::get_ussd_history))
        
        // Middlewares
        .layer(
            CorsLayer::permissive()
                .allow_headers([
                    axum::http::header::AUTHORIZATION,
                    axum::http::header::CONTENT_TYPE,
                    axum::http::header::HeaderName::from_static("x-api-key"),
                    // Critical for WebSockets
                    axum::http::header::UPGRADE,
                    axum::http::header::CONNECTION,
                    axum::http::header::SEC_WEBSOCKET_KEY,
                    axum::http::header::SEC_WEBSOCKET_VERSION,
                ])
        )
        .with_state(gateway_state);

    // 6. Start Server with Auto-Restart Loop
    let addr = std::net::SocketAddr::from(([0, 0, 0, 0], config.port));
    
    loop {
        println!("--------------------------------------------------");
        println!("[*] Initializing Gate: http://0.0.0.0:{}", config.port);
        let listener = match tokio::net::TcpListener::bind(addr).await {
            Ok(l) => l,
            Err(e) => {
                eprintln!("[!] PORT_ERROR: {}. Check if another process is using port {}.", e, config.port);
                tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                continue;
            }
        };

        println!("[+] WebSocket Handshake Gate: OPEN");
        if let Err(e) = axum::serve(listener, app.clone()).await {
            eprintln!("[!] CORE_CRASH: {}. Attempting automatic recovery...", e);
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
        } else {
            println!("[!] Clean shutdown detected. Standby.");
            break;
        }
    }


    Ok(())
}


