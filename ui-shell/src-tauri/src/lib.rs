use std::process::Command;

// This function exposes a command to our React UI layer
#[tauri::command]
fn fetch_hardware_profile() -> String {
    // Force Tauri to use the exact Python executable inside our virtual environment
    let output = Command::new("../../venv/Scripts/python.exe")
        .arg("../../backend/main.py") 
        .output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            if out.status.success() {
                stdout
            } else {
                format!("ERROR: System validation failed.\n{}", stderr)
            }
        }
        Err(_) => "ERROR: Failed to run Python backend diagnostics engine.".to_string(),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![fetch_hardware_profile])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}