//! Content scanner: finds OpenBVE routes and trains and reads their metadata.
//! Pure std (plus the text decoder), so it can be unit tested without Tauri.

use serde::Serialize;
use std::{
    collections::HashSet,
    fs,
    io::Read,
    path::{Path, PathBuf},
};

use super::text::decode;

const IMAGE_EXTENSIONS: [&str; 5] = ["png", "jpg", "jpeg", "bmp", "gif"];
const MAX_TEXT_BYTES: u64 = 768 * 1024;
const MAX_WARNINGS: usize = 400;

#[derive(Debug, Serialize, serde::Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RouteItem {
    pub name: String,
    pub path: String,
    pub group: String,
    pub comment: String,
    pub stations: Vec<String>,
    pub length_km: Option<f64>,
    pub image: Option<String>,
    pub format: String,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TrainItem {
    pub name: String,
    pub path: String,
    pub group: String,
    pub comment: String,
    pub image: Option<String>,
}

#[derive(Debug, Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub routes: Vec<RouteItem>,
    pub trains: Vec<TrainItem>,
    pub files_scanned: usize,
    pub warnings: Vec<String>,
}

impl ScanResult {
    fn warn(&mut self, message: String) {
        if self.warnings.len() < MAX_WARNINGS {
            self.warnings.push(message);
        }
    }
}

/// Scan one or more content folders. Results are merged, de-duplicated and sorted.
pub fn scan_roots(roots: &[String]) -> ScanResult {
    let mut result = ScanResult::default();
    let mut seen_dirs = HashSet::new();
    for root in roots {
        let root_path = PathBuf::from(root);
        if !root_path.is_dir() {
            result.warn(format!("Content folder not found: {root}"));
            continue;
        }
        walk(&root_path, &root_path, &mut result, &mut seen_dirs);
    }
    result.routes.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()).then(a.path.cmp(&b.path)));
    result.trains.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()).then(a.path.cmp(&b.path)));
    result.routes.dedup_by(|a, b| a.path == b.path);
    result.trains.dedup_by(|a, b| a.path == b.path);
    result
}

fn walk(root: &Path, start: &Path, result: &mut ScanResult, seen_dirs: &mut HashSet<PathBuf>) {
    let mut stack = vec![start.to_path_buf()];
    while let Some(dir) = stack.pop() {
        // canonicalize so overlapping content folders are only scanned once
        let key = fs::canonicalize(&dir).unwrap_or_else(|_| dir.clone());
        if !seen_dirs.insert(key) {
            continue;
        }
        let entries = match fs::read_dir(&dir) {
            Ok(entries) => entries,
            Err(err) => {
                result.warn(format!("Unable to read {}: {err}", dir.display()));
                continue;
            }
        };
        let mut files = Vec::new();
        for entry in entries.flatten() {
            let Ok(file_type) = entry.file_type() else { continue };
            if file_type.is_symlink() {
                continue; // avoid loops
            }
            if file_type.is_dir() {
                stack.push(entry.path());
            } else if file_type.is_file() {
                files.push(entry.path());
            }
        }
        result.files_scanned += files.len();

        let lower_names: Vec<String> = files.iter().map(|p| file_name_lower(p)).collect();
        if lower_names.iter().any(|n| n == "train.dat" || n == "train.xml") {
            result.trains.push(read_train(root, &dir, &files));
        }

        for file in &files {
            let extension = extension_lower(file);
            if extension != "csv" && extension != "rw" {
                continue;
            }
            let Some(text) = read_text(file) else {
                result.warn(format!("Could not read {}", file.display()));
                continue;
            };
            if !looks_like_route(&text, &extension) {
                continue; // most .csv files are 3D objects, not routes
            }
            let route = parse_route(root, file, &text, &extension);
            if route.stations.is_empty() {
                result.warn(format!("{}: no stations found (it may still load in OpenBVE)", route.name));
            }
            result.routes.push(route);
        }
    }
}

fn file_name_lower(path: &Path) -> String {
    path.file_name().and_then(|x| x.to_str()).unwrap_or_default().to_ascii_lowercase()
}

fn extension_lower(path: &Path) -> String {
    path.extension().and_then(|x| x.to_str()).unwrap_or_default().to_ascii_lowercase()
}

pub fn read_text(path: &Path) -> Option<String> {
    let file = fs::File::open(path).ok()?;
    let mut bytes = Vec::new();
    file.take(MAX_TEXT_BYTES).read_to_end(&mut bytes).ok()?;
    Some(decode(&bytes))
}

/// Route files vs. CSV/RW object files.
pub fn looks_like_route(text: &str, extension: &str) -> bool {
    let lower = text.to_lowercase();
    if lower.contains("createmeshbuilder") || lower.contains("addvertex") || lower.contains("[meshbuilder]") {
        return false;
    }
    if extension == "rw" {
        return lower.contains("[railway]") || lower.contains("[structure]") || lower.contains("[options]");
    }
    lower.contains("with track") || lower.contains("track.") || lower.contains(".sta ") || lower.contains(".sta(")
}

fn relative_group(root: &Path, dir: &Path) -> String {
    let rel = dir.strip_prefix(root).unwrap_or(dir);
    rel.components()
        .map(|c| c.as_os_str().to_string_lossy().into_owned())
        .collect::<Vec<_>>()
        .join(" / ")
}

/// Splits "Track.Sta Name;a;b" / ".Sta(Name;a)" / "Sta Name" into (namespace, command, arguments).
fn split_command<'a>(token: &'a str, namespace: &str) -> Option<(String, String, &'a str)> {
    let token = token.trim();
    let (space, rest) = if let Some(rest) = token.strip_prefix('.') {
        (namespace.to_string(), rest)
    } else {
        let cmd_end = token.find(|c: char| c.is_whitespace() || c == '(').unwrap_or(token.len());
        match token[..cmd_end].find('.') {
            Some(dot) => (token[..dot].to_ascii_lowercase(), &token[dot + 1..]),
            None => (namespace.to_string(), token), // RW style: "Sta Name;..."
        }
    };
    let cmd_end = rest.find(|c: char| c.is_whitespace() || c == '(').unwrap_or(rest.len());
    let command = rest[..cmd_end].to_ascii_lowercase();
    if command.is_empty() {
        return None;
    }
    let mut args = rest[cmd_end..].trim();
    if let Some(inner) = args.strip_prefix('(') {
        args = match inner.rfind(')') {
            Some(end) => &inner[..end],
            None => inner,
        };
    }
    Some((space, command, args.trim()))
}

pub fn parse_route(root: &Path, file: &Path, text: &str, extension: &str) -> RouteItem {
    let mut namespace = String::new();
    let mut comment = String::new();
    let mut image_arg: Option<String> = None;
    let mut stations: Vec<String> = Vec::new();
    let mut max_position: f64 = 0.0;
    let mut any_position = false;

    for raw in text.lines() {
        let line = raw.trim();
        if line.is_empty() || line.starts_with(';') {
            continue;
        }
        if line.starts_with('[') && line.contains(']') {
            // RW sections: [Railway] holds track commands, [Route] holds metadata
            let section = line[1..line.find(']').unwrap_or(line.len())].trim().to_ascii_lowercase();
            namespace = match section.as_str() {
                "railway" => "track".into(),
                "route" | "options" => "route".into(),
                other => other.to_string(),
            };
            continue;
        }
        for token in line.split(',') {
            let token = token.trim();
            if token.is_empty() {
                continue;
            }
            let numeric = token.strip_prefix('@').unwrap_or(token);
            if let Ok(position) = numeric.parse::<f64>() {
                if position.is_finite() {
                    max_position = max_position.max(position);
                    any_position = true;
                }
                continue;
            }
            let lower = token.to_ascii_lowercase();
            if let Some(rest) = lower.strip_prefix("with ") {
                namespace = rest.trim().to_string();
                continue;
            }
            let Some((space, command, args)) = split_command(token.trim_start_matches('@'), &namespace) else { continue };
            match (space.as_str(), command.as_str()) {
                ("route", "comment") if comment.is_empty() => {
                    comment = args.replace("\\n", " ").trim().chars().take(400).collect();
                }
                ("route", "image") if image_arg.is_none() => {
                    image_arg = Some(args.trim().trim_matches('"').to_string());
                }
                ("track", "sta") | ("railway", "sta") => {
                    let name = args.split(';').next().unwrap_or("").trim().to_string();
                    if !name.is_empty() && !stations.contains(&name) && stations.len() < 300 {
                        stations.push(name);
                    }
                }
                _ => {}
            }
        }
    }

    let folder = file.parent().unwrap_or(Path::new("."));
    let mut image = image_arg
        .map(|arg| folder.join(arg.replace('\\', std::path::MAIN_SEPARATOR_STR)))
        .filter(|p| p.is_file());
    if image.is_none() {
        let stem = file.file_stem().and_then(|x| x.to_str()).unwrap_or_default();
        image = find_image(folder, stem);
    }

    RouteItem {
        name: file.file_stem().and_then(|x| x.to_str()).unwrap_or("Unnamed route").to_string(),
        path: file.to_string_lossy().into_owned(),
        group: relative_group(root, folder),
        comment,
        stations,
        length_km: if any_position && max_position > 0.0 { Some((max_position / 100.0).round() / 10.0) } else { None },
        image: image.map(|p| p.to_string_lossy().into_owned()),
        format: extension.to_ascii_uppercase(),
    }
}

/// Image next to a file with the given stem, any case, any common extension.
fn find_image(folder: &Path, stem: &str) -> Option<PathBuf> {
    let stem = stem.to_lowercase();
    let entries = fs::read_dir(folder).ok()?;
    let mut found: Vec<PathBuf> = entries
        .flatten()
        .map(|e| e.path())
        .filter(|p| {
            p.is_file()
                && p.file_stem().and_then(|x| x.to_str()).map(|s| s.to_lowercase() == stem).unwrap_or(false)
                && IMAGE_EXTENSIONS.contains(&extension_lower(p).as_str())
        })
        .collect();
    found.sort();
    found.into_iter().next()
}

fn read_train(root: &Path, dir: &Path, files: &[PathBuf]) -> TrainItem {
    let comment = files
        .iter()
        .find(|p| file_name_lower(p) == "train.txt")
        .and_then(|p| read_text(p))
        .map(|t| t.trim().chars().take(600).collect())
        .unwrap_or_default();
    let name = dir.file_name().and_then(|x| x.to_str()).unwrap_or("Unnamed train").to_string();
    let parent = dir.parent().unwrap_or(dir);
    TrainItem {
        name,
        path: dir.to_string_lossy().into_owned(),
        group: relative_group(root, parent),
        comment,
        image: find_image(dir, "train").map(|p| p.to_string_lossy().into_owned()),
    }
}

pub fn is_image_path(path: &Path) -> bool {
    IMAGE_EXTENSIONS.contains(&extension_lower(path).as_str())
}

pub fn image_mime(path: &Path) -> &'static str {
    match extension_lower(path).as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "bmp" => "image/bmp",
        "gif" => "image/gif",
        _ => "application/octet-stream",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_routes_not_objects() {
        assert!(looks_like_route("With Track\n0, .Sta A", "csv"));
        assert!(!looks_like_route("CreateMeshBuilder\nAddVertex 0,0,0", "csv"));
    }

    #[test]
    fn splits_commands() {
        assert_eq!(split_command(".Sta Pasir Ris;;0700", "track").unwrap(), ("track".into(), "sta".into(), "Pasir Ris;;0700"));
        assert_eq!(split_command("Track.Sta(Tampines;07.00)", "").unwrap(), ("track".into(), "sta".into(), "Tampines;07.00"));
        assert_eq!(split_command("Route.Comment Hello world", "").unwrap(), ("route".into(), "comment".into(), "Hello world"));
    }
}
