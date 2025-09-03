use std::process::Child;
use std::sync::Mutex;
use tauri::{State, AppHandle, Manager};

pub struct ServerState {
    pub process: Mutex<Option<Child>>,
}

#[tauri::command]
pub fn start_backend_server(app: AppHandle, state: State<ServerState>) -> Result<String, String> {
    let mut process = state.process.lock().unwrap();
    
    if process.is_some() {
        return Ok("Server already running".to_string());
    }
    
    // Get the path to the sidecar binary
    let server_path = app
        .path()
        .resource_dir()
        .expect("failed to resolve resource directory")
        .join("server");
    
    #[cfg(target_os = "macos")]
    let server_binary = server_path.join("server-macos-arm64");
    
    #[cfg(target_os = "windows")]
    let server_binary = server_path.join("server-win-x64.exe");
    
    #[cfg(target_os = "linux")]
    let server_binary = server_path.join("server-linux-x64");
    
    println!("Server binary path: {:?}", server_binary);
    
    // Check if binary exists
    if !server_binary.exists() {
        return Err(format!("Server binary not found at: {:?}", server_binary));
    }
    
    println!("About to spawn server with command: {:?}", server_binary);
    println!("Environment: NODE_ENV=production, PORT=3005, HOST=127.0.0.1, TAURI=1");
    
    // Start the sidecar server with proper output handling
    let mut child = std::process::Command::new(&server_binary)
        .env("NODE_ENV", "production")
        .env("PORT", "3005")
        .env("HOST", "127.0.0.1")
        .env("TAURI", "1")  // Signal that we're running in Tauri
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start server at {:?}: {}", server_binary, e))?;
    
    println!("Server spawned with PID: {}", child.id());
    
    *process = Some(child);
    
    // Wait longer for the server to fully start
    std::thread::sleep(std::time::Duration::from_secs(3));
    
    println!("Server process started, waiting for it to be ready...");
    
    Ok("Server started on port 3005".to_string())
}

#[tauri::command]
pub fn stop_backend_server(state: State<ServerState>) -> Result<String, String> {
    let mut process = state.process.lock().unwrap();
    
    if let Some(mut child) = process.take() {
        child.kill().map_err(|e| format!("Failed to stop server: {}", e))?;
        Ok("Server stopped".to_string())
    } else {
        Ok("Server not running".to_string())
    }
}

#[tauri::command]
pub fn check_server_status() -> Result<bool, String> {
    // Check if server is responding
    let output = std::process::Command::new("curl")
        .arg("-s")
        .arg("http://localhost:3005/api/hello")
        .output()
        .map_err(|e| format!("Failed to check server: {}", e))?;
    
    Ok(output.status.success())
}