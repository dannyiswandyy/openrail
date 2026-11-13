//! Compatibility parser primitives for OpenBVE CSV/RW routes.
//! This is an independent parser; it only implements the documented file grammar.

use serde::{Deserialize, Serialize};
use super::content::read_text;
use std::{path::PathBuf, collections::HashMap};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RouteCommand {
    pub position_m: f64,
    pub namespace: String,
    pub command: String,
    pub arguments: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ParsedRoute {
    pub commands: Vec<RouteCommand>,
    pub max_position_m: f64,
}

pub fn parse_route_file(path: &str) -> Result<ParsedRoute, String> {
    let text = read_text(&PathBuf::from(path)).ok_or_else(|| format!("Unable to read {path}"))?;
    parse_csv(&text)
}

pub fn parse_csv(text: &str) -> Result<ParsedRoute, String> {
    let mut result = ParsedRoute::default();
    let mut namespace = String::new();
    let mut position = 0.0;

    for raw in text.lines() {
        let line = raw.trim();
        if line.is_empty() || line.starts_with(';') { continue; }
        for expr in line.split(',') {
            let expr = expr.trim();
            if expr.is_empty() || expr.starts_with(';') { continue; }
            if let Ok(p) = expr.parse::<f64>() {
                if p >= 0.0 { position = p; result.max_position_m = result.max_position_m.max(p); }
                continue;
            }
            if let Some(prefix) = expr.strip_prefix("With ") {
                namespace = prefix.trim().to_ascii_lowercase();
                continue;
            }
            let (name, args) = if let Some(open) = expr.find('(') {
                let name = expr[..open].trim();
                let args = expr[open+1..].trim_end_matches(')').split(';').map(|x| x.trim().to_string()).collect();
                (name.to_string(), args)
            } else {
                let mut parts = expr.splitn(2, char::is_whitespace);
                let name = parts.next().unwrap_or_default().to_string();
                let args = parts.next().unwrap_or_default().split(';').map(|x| x.trim().to_string()).filter(|x| !x.is_empty()).collect();
                (name, args)
            };
            let (ns, cmd) = if let Some(dot) = name.find('.') {
                (name[..dot].to_ascii_lowercase(), name[dot+1..].to_ascii_lowercase())
            } else {
                (namespace.clone(), name.to_ascii_lowercase())
            };
            result.commands.push(RouteCommand { position_m: position, namespace: ns, command: cmd, arguments: args });
        }
    }
    Ok(result)
}

pub fn station_index(route: &ParsedRoute) -> HashMap<String, f64> {
    let mut stations = HashMap::new();
    for c in &route.commands {
        if c.command == "sta" || c.command == "station" {
            if let Some(name) = c.arguments.first().filter(|x| !x.is_empty()) {
                stations.entry(name.clone()).or_insert(c.position_m);
            }
        }
    }
    stations
}
