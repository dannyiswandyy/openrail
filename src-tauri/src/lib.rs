use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
};
use walkdir::WalkDir;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RouteItem {
    name: String,
    path: String,
    format: String,
    size: u64,
    stations: usize,
    commands: usize,
    health: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TrainItem {
    name: String,
    path: String,
    format: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LibraryIndex {
    root: String,
    routes: Vec<RouteItem>,
    trains: Vec<TrainItem>,
    files: usize,
}

#[derive(Debug, Serialize)]
struct Validation {
    path: String,
    checked: usize,
    missing: Vec<String>,
    warnings: Vec<String>,
}

fn file_name(path: &Path) -> String {
    path.file_stem().and_then(|x| x.to_str()).unwrap_or("Untitled").to_string()
}

fn parse_route(path: &Path) -> Result<RouteItem, String> {
    let bytes = fs::read(path).map_err(|e| e.to_string())?;
    let text = String::from_utf8_lossy(&bytes);
    let mut stations = 0usize;
    let mut commands = 0usize;
    let mut missing_hint = false;

    for raw in text.lines() {
        let line = raw.trim();
        if line.is_empty() || line.starts_with(';') || line.starts_with('#') {
            continue;
        }
        commands += 1;
        let lower = line.to_ascii_lowercase();
        if lower.contains("station") && (lower.contains(".set") || lower.contains("station")) {
            stations += 1;
        }
        if lower.contains("structure.") && lower.contains("null") {
            missing_hint = true;
        }
    }

    let ext = path.extension().and_then(|x| x.to_str()).unwrap_or("").to_ascii_uppercase();
    Ok(RouteItem {
        name: file_name(path),
        path: path.to_string_lossy().to_string(),
        format: ext,
        size: bytes.len() as u64,
        stations,
        commands,
        health: if missing_hint { "attention".into() } else { "ready".into() },
    })
}

fn scan_root(root: &Path) -> LibraryIndex {
    let mut routes = Vec::new();
    let mut trains = Vec::new();
    let mut files = 0usize;

    for entry in WalkDir::new(root).follow_links(false).into_iter().filter_map(Result::ok) {
        if !entry.file_type().is_file() {
            continue;
        }
        files += 1;
        let path = entry.path();
        match path.extension().and_then(|x| x.to_str()).map(|x| x.to_ascii_lowercase()) {
            Some(ext) if ext == "csv" || ext == "rw" => {
                if let Ok(route) = parse_route(path) {
                    routes.push(route);
                }
            }
            Some(ext) if ext == "dat" && path.file_name().and_then(|x| x.to_str()).unwrap_or("").eq_ignore_ascii_case("train.dat") => {
                trains.push(TrainItem {
                    name: path.parent().map(file_name).unwrap_or_else(|| "Train".into()),
                    path: path.to_string_lossy().to_string(),
                    format: "train.dat".into(),
                });
            }
            _ => {}
        }
        if routes.len() >= 500 { break; }
    }

    routes.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    trains.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    LibraryIndex {
        root: root.to_string_lossy().to_string(),
        routes,
        trains,
        files,
    }
}

#[tauri::command]
fn scan_library(root: String) -> Result<LibraryIndex, String> {
    let path = PathBuf::from(&root);
    if !path.is_dir() {
        return Err(format!("Not a directory: {root}"));
    }
    Ok(scan_root(&path))
}

#[tauri::command]
fn validate_route(path: String) -> Result<Validation, String> {
    let route = PathBuf::from(&path);
    let text = fs::read_to_string(&route).map_err(|e| e.to_string())?;
    let base = route.parent().unwrap_or(Path::new("."));
    let mut missing = Vec::new();
    let mut checked = 0usize;

    for raw in text.lines() {
        let line = raw.trim();
        if line.is_empty() || line.starts_with(';') || line.starts_with('#') {
            continue;
        }
        for token in line.split([';', ',', '(', ')', ' ', '\t']) {
            let token = token.trim_matches('"').trim_matches('\'');
            let lower = token.to_ascii_lowercase();
            let looks_like_file = [
                ".b3d", ".x", ".obj", ".l3d", ".animated", ".csv", ".rw",
                ".wav", ".flac", ".ogg", ".bmp", ".png", ".jpg", ".jpeg",
                ".gif", ".panel", ".cfg", ".dat"
            ].iter().any(|ext| lower.ends_with(ext));

            if !looks_like_file || token.len() < 3 {
                continue;
            }
            checked += 1;
            let candidate = base.join(token);
            if !candidate.exists() {
                missing.push(token.to_string());
            }
        }
    }

    missing.sort();
    missing.dedup();
    Ok(Validation {
        path,
        checked,
        missing,
        warnings: Vec::new(),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![scan_library, validate_route])
        .run(tauri::generate_context!())
        .expect("error while running OpenRail");
}
