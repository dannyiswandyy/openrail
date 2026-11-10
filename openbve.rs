use serde::Serialize;
use std::{fs, path::{Path, PathBuf}, process::Command};

#[derive(Debug, Serialize, Clone)]
pub struct Installation {
    pub found: bool,
    pub executable: Option<String>,
    pub searched: Vec<String>,
}

#[tauri::command]
pub fn detect_openbve() -> Installation {
    let candidates = executable_candidates();
    for path in &candidates {
        if path.is_file() {
            return Installation {
                found: true,
                executable: Some(path.to_string_lossy().into_owned()),
                searched: candidates.iter().map(|p| p.to_string_lossy().into_owned()).collect(),
            };
        }
    }

    // Also respect an executable available on PATH.
    if let Ok(output) = Command::new(if cfg!(windows) { "where" } else { "which" })
        .arg("openbve.exe")
        .output()
    {
        if output.status.success() {
            if let Some(line) = String::from_utf8_lossy(&output.stdout).lines().find(|x| !x.trim().is_empty()) {
                let path = PathBuf::from(line.trim());
                if path.is_file() {
                    return Installation {
                        found: true,
                        executable: Some(path.to_string_lossy().into_owned()),
                        searched: candidates.iter().map(|p| p.to_string_lossy().into_owned()).collect(),
                    };
                }
            }
        }
    }

    Installation {
        found: false,
        executable: None,
        searched: candidates.iter().map(|p| p.to_string_lossy().into_owned()).collect(),
    }
}

fn executable_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    if cfg!(windows) {
        if let Ok(v) = std::env::var("ProgramFiles") {
            candidates.push(PathBuf::from(v).join("openBVE/openBve.exe"));
            candidates.push(PathBuf::from(v).join("openBVE/OpenBve.exe"));
        }
        if let Ok(v) = std::env::var("ProgramFiles(x86)") {
            candidates.push(PathBuf::from(v).join("openBVE/openBve.exe"));
            candidates.push(PathBuf::from(v).join("openBVE/OpenBve.exe"));
        }
        if let Ok(v) = std::env::var("LOCALAPPDATA") {
            candidates.push(PathBuf::from(v).join("openBVE/openBve.exe"));
            candidates.push(PathBuf::from(v).join("Programs/openBVE/openBve.exe"));
        }
    } else {
        candidates.extend([
            PathBuf::from("/usr/bin/openbve"),
            PathBuf::from("/usr/local/bin/openbve"),
            PathBuf::from("/Applications/openBVE.app/Contents/MacOS/openBVE"),
        ]);
    }

    candidates
}

#[derive(Debug, Serialize, Clone)]
pub struct ContentItem {
    pub name: String,
    pub path: String,
    pub kind: String,
    pub files: usize,
}

#[derive(Debug, Serialize, Clone)]
pub struct ScanResult {
    pub routes: Vec<ContentItem>,
    pub trains: Vec<ContentItem>,
    pub files_scanned: usize,
    pub warnings: Vec<String>,
}

fn walk(path: &Path, result: &mut ScanResult) {
    let entries = match fs::read_dir(path) {
        Ok(entries) => entries,
        Err(err) => {
            result.warnings.push(format!("Unable to read {}: {}", path.display(), err));
            return;
        }
    };

    for entry in entries.flatten() {
        let p = entry.path();
        if p.is_dir() {
            walk(&p, result);
            continue;
        }

        result.files_scanned += 1;
        let file_name = p.file_name().and_then(|x| x.to_str()).unwrap_or_default().to_ascii_lowercase();
        let extension = p.extension().and_then(|x| x.to_str()).unwrap_or_default().to_ascii_lowercase();

        if file_name == "train.dat" {
            if let Some(parent) = p.parent() {
                result.trains.push(ContentItem {
                    name: parent.file_name().and_then(|x| x.to_str()).unwrap_or("Unnamed train").to_string(),
                    path: parent.to_string_lossy().into_owned(),
                    kind: "train".into(),
                    files: count_files(parent),
                });
            }
        } else if matches!(extension.as_str(), "csv" | "rw" | "route") {
            result.routes.push(ContentItem {
                name: p.file_stem().and_then(|x| x.to_str()).unwrap_or("Unnamed route").to_string(),
                path: p.to_string_lossy().into_owned(),
                kind: "route".into(),
                files: p.parent().map(count_files).unwrap_or(1),
            });
        }
    }
}

fn count_files(path: &Path) -> usize {
    fs::read_dir(path)
        .map(|x| x.flatten().filter(|e| e.path().is_file()).count())
        .unwrap_or(0)
}

#[tauri::command]
pub fn scan_content(root: String) -> Result<ScanResult, String> {
    let path = PathBuf::from(&root);
    if !path.is_dir() {
        return Err(format!("Content directory does not exist: {}", root));
    }

    let mut result = ScanResult { routes: vec![], trains: vec![], files_scanned: 0, warnings: vec![] };
    walk(&path, &mut result);
    result.routes.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    result.trains.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    result.routes.dedup_by(|a, b| a.path == b.path);
    result.trains.dedup_by(|a, b| a.path == b.path);
    Ok(result)
}

#[tauri::command]
pub fn launch_openbve(executable: String, route: String, train: Option<String>) -> Result<(), String> {
    if !Path::new(&executable).is_file() {
        return Err("OpenBVE executable was not found.".into());
    }
    if !Path::new(&route).is_file() {
        return Err("The selected route file was not found.".into());
    }

    let mut command = Command::new(&executable);
    command.arg(format!("/route={route}"));
    if let Some(train_path) = train.filter(|x| !x.trim().is_empty()) {
        if !Path::new(&train_path).is_dir() {
            return Err("The selected train folder was not found.".into());
        }
        command.arg(format!("/train={train_path}"));
    }

    command.spawn()
        .map(|_| ())
        .map_err(|e| format!("Failed to launch OpenBVE: {e}"))
}
