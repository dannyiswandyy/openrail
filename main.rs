#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod openbve;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            openbve::detect_openbve,
            openbve::scan_content
        ])
        .run(tauri::generate_context!())
        .expect("error while running OpenBVE Launcher");
}
