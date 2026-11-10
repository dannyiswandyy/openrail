//! Tauri commands: OpenBVE detection, content scanning, images, dialogs, launching.

use base64::Engine;
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
};
use tauri_plugin_dialog::DialogExt;

use super::content::{image_mime, is_image_path, scan_roots, ScanResult};

const MAX_IMAGE_BYTES: u64 = 12 * 1024 * 1024;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Installation {
    pub found: bool,
    pub executable: Option<String>,
    /// Content folders that exist in the usual places (Railway/Route, Train...)
    pub content_hints: Vec<String>,
}

fn executable_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    for var in ["ProgramFiles(x86)", "ProgramFiles"] {
        if let Ok(base) = std::env::var(var) {
            candidates.push(PathBuf::from(&base).join("openBVE").join("OpenBve.exe"));
            candidates.push(PathBuf::from(&base).join("OpenBVE").join("OpenBve.exe"));
        }
    }
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        candidates.push(PathBuf::from(&local).join("Programs").join("openBVE").join("OpenBve.exe"));
        candidates.push(PathBuf::from(&local).join("openBVE").join("OpenBve.exe"));
    }
    for p in ["/usr/lib/openbve/OpenBve.exe", "/usr/share/games/openbve/OpenBve.exe", "/opt/openbve/OpenBve.exe", "/Applications/OpenBVE.app"] {
        candidates.push(PathBuf::from(p));
    }
    candidates
}

fn content_hints() -> Vec<String> {
    let mut bases = Vec::new();
    if let Ok(appdata) = std::env::var("APPDATA") {
        bases.push(PathBuf::from(appdata).join("openBVE"));
    }
    if let Some(home) = std::env::var_os("HOME").or_else(|| std::env::var_os("USERPROFILE")) {
        let home = PathBuf::from(home);
        bases.push(home.join(".config").join("OpenBve"));
        bases.push(home.join("Library").join("Application Support").join("OpenBve"));
        bases.push(home.join("Documents").join("OpenBVE"));
        bases.push(home.join("OpenBVE"));
    }
    let mut hints = Vec::new();
    for base in bases {
        for sub in ["LegacyContent", ""] {
            let folder = if sub.is_empty() { base.clone() } else { base.join(sub) };
            if folder.join("Railway").is_dir() || folder.join("Train").is_dir() {
                let s = folder.to_string_lossy().into_owned();
                if !hints.contains(&s) {
                    hints.push(s);
                }
            }
        }
    }
    hints
}

#[tauri::command]
pub fn detect_openbve() -> Installation {
    let executable = executable_candidates().into_iter().find(|p| p.exists()).map(|p| p.to_string_lossy().into_owned());
    Installation { found: executable.is_some(), executable, content_hints: content_hints() }
}

#[tauri::command]
pub async fn scan_content(roots: Vec<String>) -> Result<ScanResult, String> {
    if roots.is_empty() {
        return Err("Add a content folder first.".into());
    }
    tauri::async_runtime::spawn_blocking(move || scan_roots(&roots))
        .await
        .map_err(|e| format!("Scan failed: {e}"))
}

/// Returns an image as a data: URL so the web view can show route/train previews.
#[tauri::command]
pub async fn read_image(path: String) -> Result<String, String> {
    let p = PathBuf::from(&path);
    if !is_image_path(&p) {
        return Err("Not an image file.".into());
    }
    let size = fs::metadata(&p).map_err(|e| e.to_string())?.len();
    if size > MAX_IMAGE_BYTES {
        return Err("Image is too large to preview.".into());
    }
    let bytes = fs::read(&p).map_err(|e| e.to_string())?;
    Ok(format!("data:{};base64,{}", image_mime(&p), base64::engine::general_purpose::STANDARD.encode(bytes)))
}

#[tauri::command]
pub async fn pick_folder(app: tauri::AppHandle, title: String) -> Option<String> {
    app.dialog()
        .file()
        .set_title(title)
        .blocking_pick_folder()
        .and_then(|p| p.into_path().ok())
        .map(|p| p.to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn pick_executable(app: tauri::AppHandle) -> Option<String> {
    let dialog = app.dialog().file().set_title("Select OpenBVE (OpenBve.exe)");
    let dialog = if cfg!(target_os = "windows") { dialog.add_filter("OpenBVE", &["exe"]) } else { dialog };
    dialog.blocking_pick_file().and_then(|p| p.into_path().ok()).map(|p| p.to_string_lossy().into_owned())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchOptions {
    pub executable: String,
    pub route: String,
    #[serde(default)]
    pub train: Option<String>,
    #[serde(default)]
    pub station: Option<String>,
    #[serde(default)]
    pub start_time: Option<String>,
    #[serde(default)]
    pub ai: bool,
    #[serde(default)]
    pub fullscreen: bool,
    #[serde(default)]
    pub width: Option<u32>,
    #[serde(default)]
    pub height: Option<u32>,
}

/// "7:30" / "07:30:15" -> OpenBVE's "7.30" / "7.3015"
pub fn to_openbve_time(input: &str) -> Result<String, String> {
    let parts: Vec<&str> = input.trim().split([':', '.']).collect();
    let ok = (2..=3).contains(&parts.len())
        && parts.iter().all(|p| !p.is_empty() && p.chars().all(|c| c.is_ascii_digit()))
        && parts[1..].iter().all(|p| p.len() == 2);
    if !ok {
        return Err("Start time should look like 07:30 or 07:30:00".into());
    }
    let hours: u32 = parts[0].parse().map_err(|_| "Bad hour")?;
    let minutes: u32 = parts[1].parse().map_err(|_| "Bad minutes")?;
    if hours > 47 || minutes > 59 {
        return Err("Start time is out of range".into());
    }
    Ok(format!("{hours}.{}{}", parts[1], parts.get(2).copied().unwrap_or("")))
}

pub fn build_arguments(o: &LaunchOptions) -> Result<Vec<String>, String> {
    let mut args = vec![format!("/route={}", o.route)];
    if let Some(train) = o.train.as_deref().filter(|x| !x.trim().is_empty()) {
        args.push(format!("/train={train}"));
    }
    if let Some(station) = o.station.as_deref().filter(|x| !x.trim().is_empty()) {
        args.push(format!("/station={}", station.trim()));
    }
    if let Some(time) = o.start_time.as_deref().filter(|x| !x.trim().is_empty()) {
        args.push(format!("/time={}", to_openbve_time(time)?));
    }
    args.push(format!("/ai={}", o.ai));
    args.push(format!("/fullscreen={}", o.fullscreen));
    if let (Some(w), Some(h)) = (o.width, o.height) {
        if w >= 320 && h >= 240 {
            args.push(format!("/width={w}"));
            args.push(format!("/height={h}"));
        }
    }
    Ok(args)
}

#[tauri::command]
pub fn launch_openbve(options: LaunchOptions) -> Result<String, String> {
    let exe = Path::new(&options.executable);
    if !exe.exists() {
        return Err("OpenBVE was not found. Check the location in Settings.".into());
    }
    if !Path::new(&options.route).is_file() {
        return Err("That route file no longer exists. Rescan your content.".into());
    }
    let args = build_arguments(&options)?;
    let is_app_bundle = exe.extension().map(|e| e.eq_ignore_ascii_case("app")).unwrap_or(false);
    let is_dotnet_exe = exe.extension().map(|e| e.eq_ignore_ascii_case("exe")).unwrap_or(false);

    let mut command = if is_app_bundle {
        let mut c = Command::new("open");
        c.arg("-a").arg(exe).arg("--args");
        c
    } else if is_dotnet_exe && !cfg!(target_os = "windows") {
        let mut c = Command::new("mono"); // OpenBVE is a .NET program
        c.arg(exe);
        c
    } else {
        Command::new(exe)
    };
    command.args(&args);
    if let Some(dir) = exe.parent().filter(|d| d.is_dir() && !is_app_bundle) {
        command.current_dir(dir);
    }
    command
        .spawn()
        .map(|_| "OpenBVE is starting…".to_string())
        .map_err(|e| format!("Failed to launch OpenBVE: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_times() {
        assert_eq!(to_openbve_time("07:30").unwrap(), "7.30");
        assert_eq!(to_openbve_time("7:05:09").unwrap(), "7.0509");
        assert!(to_openbve_time("7").is_err());
        assert!(to_openbve_time("07:3").is_err());
    }
}
