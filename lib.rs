mod core;

use core::openbve::{detect_openbve, launch_openbve, scan_content};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![detect_openbve, scan_content, launch_openbve])
        .run(tauri::generate_context!())
        .expect("error while running OpenRail");
}
