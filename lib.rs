mod core;

use core::openbve::{detect_openbve, launch_openbve, pick_executable, pick_folder, read_image, scan_content};

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
            launch_openbve
        ])
        .run(tauri::generate_context!())
        .expect("error while running OpenRail");
}
