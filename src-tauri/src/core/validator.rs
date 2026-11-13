//! OpenRail Phase 1 validator: dependency and content health checks.
//! Conservative by design: it reports missing referenced assets without modifying user content.

use serde::Serialize;
use std::{collections::HashSet, fs, path::{Path, PathBuf}};

use super::content::{read_text, RouteItem};

const ASSET_EXTENSIONS: [&str; 18] = [
    "csv","rw","b3d","x","obj","animated","l3d","png","jpg","jpeg","bmp","gif",
    "wav","ogg","mp3","sound","panel","cfg",
];

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ValidationIssue {
    pub severity: String,
    pub code: String,
    pub message: String,
    pub path: String,
}

#[derive(Debug, Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct ValidationReport {
    pub route: String,
    pub checked_files: usize,
    pub missing_files: usize,
    pub issues: Vec<ValidationIssue>,
}

fn is_asset_reference(token: &str) -> bool {
    let t = token.trim().trim_matches(['"', '\'', '(', ')', '[', ']']);
    let lower = t.to_ascii_lowercase();
    ASSET_EXTENSIONS.iter().any(|ext| lower.ends_with(&format!(".{ext}")))
        && !lower.contains("://")
        && !t.contains('=')
        && t.len() < 512
}

fn candidates(route_dir: &Path, reference: &str) -> Vec<PathBuf> {
    let clean = reference.trim().trim_matches(['"', '\'', '(', ')', '[', ']'])
        .replace('\\', std::path::MAIN_SEPARATOR_STR)
        .replace('/', std::path::MAIN_SEPARATOR_STR);
    let direct = route_dir.join(&clean);
    vec![direct]
}

/// Validate a route conservatively. OpenBVE route syntax is broad, so we only
/// inspect explicit file-like tokens and never treat unknown tokens as errors.
pub fn validate_route(route: &RouteItem) -> Result<ValidationReport, String> {
    let path = PathBuf::from(&route.path);
    let text = read_text(&path).ok_or_else(|| format!("Unable to read route: {}", route.path))?;
    let route_dir = path.parent().unwrap_or(Path::new("."));
    let mut seen = HashSet::new();
    let mut report = ValidationReport { route: route.path.clone(), ..Default::default() };

    for raw in text.lines() {
        for token in raw.split([';', ',', ' ', '\t']) {
            if !is_asset_reference(token) { continue; }
            let normalized = token.trim().trim_matches(['"', '\'', '(', ')', '[', ']']).to_string();
            if !seen.insert(normalized.to_ascii_lowercase()) { continue; }
            report.checked_files += 1;
            let found = candidates(route_dir, &normalized).iter().any(|p| p.is_file());
            if !found {
                report.missing_files += 1;
                if report.issues.len() < 300 {
                    report.issues.push(ValidationIssue {
                        severity: "warning".into(),
                        code: "MISSING_ASSET".into(),
                        message: format!("Referenced asset was not found: {normalized}"),
                        path: normalized,
                    });
                }
            }
        }
    }

    if report.issues.is_empty() {
        report.issues.push(ValidationIssue {
            severity: "ok".into(),
            code: "HEALTHY".into(),
            message: "No missing file-like references were detected.".into(),
            path: route.path.clone(),
        });
    }
    Ok(report)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn recognizes_assets() {
        assert!(is_asset_reference("objects\\tree.csv"));
        assert!(is_asset_reference("sound.wav"));
        assert!(!is_asset_reference("hello"));
        assert!(!is_asset_reference("https://example.com/a.wav"));
    }
}
