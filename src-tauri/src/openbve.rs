use std::path::PathBuf;

#[derive(serde::Serialize)]
pub struct Installation {
    pub found: bool,
    pub executable: Option<String>,
}

#[tauri::command]
pub fn detect_openbve() -> Installation {
    let candidates = [
        r"C:\Program Files\openBVE\openBve.exe",
        r"C:\Program Files (x86)\openBVE\openBve.exe",
    ];

    for candidate in candidates {
        let path = PathBuf::from(candidate);
        if path.exists() {
            return Installation {
                found: true,
                executable: Some(candidate.to_string()),
            };
        }
    }

    Installation {
        found: false,
        executable: None,
    }
}

#[derive(serde::Serialize)]
pub struct ScanResult {
    pub routes: Vec<String>,
    pub trains: Vec<String>,
}

#[tauri::command]
pub fn scan_content(root: String) -> ScanResult {
    // v0.1 scanner placeholder. The next milestone will recursively parse
    // OpenBVE route/train structures without modifying user content.
    let _ = root;

    ScanResult {
        routes: Vec::new(),
        trains: Vec::new(),
    }
}
