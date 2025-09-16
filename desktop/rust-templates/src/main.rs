// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::Command;
use std::thread;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Manager, AppHandle};
use std::path::PathBuf;

fn main() {
    // Flag to track if backend is ready
    let backend_ready = Arc::new(AtomicBool::new(false));
    let backend_ready_clone = backend_ready.clone();

    // Start the Node.js backend server
    thread::spawn(move || {
        println!("Starting backend server...");
        
        // Use resource directory for backend path
        let resource_dir = std::env::current_exe()
            .ok()
            .and_then(|path| path.parent().map(|p| p.to_path_buf()))
            .unwrap_or_else(|| PathBuf::from("."));
        
        let backend_path = resource_dir.join("backend").join("index.js");
        let backend_exists = backend_path.exists();
        
        if !backend_exists {
            println!("Backend not found at: {:?}", backend_path);
            println!("Building backend...");
            // Build the backend first if needed
            let build_output = Command::new("npm")
                .args(&["run", "build"])
                .current_dir(resource_dir.parent().unwrap_or(&resource_dir))
                .output();
                
            match build_output {
                Ok(output) => {
                    if !output.status.success() {
                        eprintln!("Backend build failed: {}", String::from_utf8_lossy(&output.stderr));
                    } else {
                        println!("Backend built successfully");
                    }
                }
                Err(e) => eprintln!("Failed to build backend: {}", e),
            }
        }

        // Start the backend server
        let mut child = Command::new("node")
            .arg(backend_path.to_str().unwrap_or("backend/index.js"))
            .current_dir(&resource_dir)
            .env("NODE_ENV", "production")
            .env("DESKTOP", "true")
            .spawn()
            .expect("Failed to start backend server");
        
        // Poll backend health endpoint instead of hardcoded sleep
        println!("Waiting for backend to be ready...");
        let start_time = std::time::Instant::now();
        let timeout = std::time::Duration::from_secs(30);
        
        loop {
            // Try common API ports
            let ports = vec![8080, 7500, 5000, 3000];
            let mut backend_found = false;
            for port in &ports {
                if let Ok(response) = reqwest::blocking::Client::new()
                    .get(&format!("http://localhost:{}/api/health", port))
                    .timeout(std::time::Duration::from_secs(1))
                    .send() 
                {
                    if response.status().is_success() {
                        backend_ready_clone.store(true, Ordering::Relaxed);
                        println!("Backend server is ready on port {}!", port);
                        backend_found = true;
                        break;
                    }
                }
            }
            
            if backend_found {
                break;
            }
            
            if start_time.elapsed() > timeout {
                eprintln!("Backend failed to start within timeout");
                break;
            }
            
            thread::sleep(std::time::Duration::from_millis(500));
        }
        
        let _ = child.wait();
    });

    // Wait for backend to be ready
    println!("Waiting for backend to start...");
    while !backend_ready.load(Ordering::Relaxed) {
        thread::sleep(std::time::Duration::from_millis(100));
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }
            }
            
            // Log app data directory for debugging
            if let Ok(app_dir) = app.path().app_data_dir() {
                println!("App data directory: {:?}", app_dir);
            }
            
            // Log app log directory
            if let Ok(log_dir) = app.path().app_log_dir() {
                println!("App log directory: {:?}", log_dir);
            }
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_logs,
            clear_logs
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// Command to get logs from the backend API
#[tauri::command]
async fn get_logs() -> Result<serde_json::Value, String> {
    // Call the Node.js backend API instead of direct file access
    let client = reqwest::Client::new();
    let response = client
        .get("http://localhost:8080/api/logs/entries?limit=1000")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    if response.status().is_success() {
        response.json::<serde_json::Value>()
            .await
            .map_err(|e| e.to_string())
    } else {
        Err(format!("Failed to fetch logs: {}", response.status()))
    }
}

// Command to clear logs via backend API
#[tauri::command]
async fn clear_logs() -> Result<(), String> {
    let client = reqwest::Client::new();
    let response = client
        .post("http://localhost:8080/api/logs/clear")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    if response.status().is_success() {
        Ok(())
    } else {
        Err(format!("Failed to clear logs: {}", response.status()))
    }
}
