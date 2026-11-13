mod core;

use core::openbve::{detect_openbve, launch_openbve, pick_executable, pick_folder, read_image, scan_content};
use core::validator::validate_route;
use core::content::RouteItem;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            detect_openbve,
            scan_content,
            read_image,
            pick_folder,
            pick_executable,
            launch_openbve,
            validate_route_command
        ])
        .run(tauri::generate_context!())
        .expect("error while running OpenRail");
}

#[tauri::command]
pub async fn validate_route_command(route: RouteItem) -> Result<core::validator::ValidationReport, String> {
    tauri::async_runtime::spawn_blocking(move || validate_route(&route))
        .await
        .map_err(|e| format!("Validation failed: {e}"))?
}
