// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod server;

use tauri::Manager;
use std::sync::Mutex;
use server::{ServerState, start_backend_server, stop_backend_server, check_server_status};

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Initialize server state
            app.manage(ServerState {
                process: Mutex::new(None),
            });
            
            // Get the main window
            let window = app.get_webview_window("main").unwrap();
            
            // Set window decorations and behavior
            #[cfg(target_os = "macos")]
            {
                use tauri::TitleBarStyle;
                window.set_title_bar_style(TitleBarStyle::Transparent).unwrap();
            }
            
            // Start the backend server automatically
            let app_handle = app.handle().clone();
            let state = app.state::<ServerState>();
            println!("Attempting to start backend server...");
            match start_backend_server(app_handle, state) {
                Ok(msg) => println!("Server start result: {}", msg),
                Err(e) => eprintln!("Failed to start backend server: {}", e),
            }
            
            Ok(())
        })
        .on_window_event(|window, event| {
            // Stop server when window is closed
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let app = window.app_handle();
                let state = app.state::<ServerState>();
                let _ = stop_backend_server(state);
            }
        })
        .invoke_handler(tauri::generate_handler![
            start_backend_server,
            stop_backend_server,
            check_server_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}