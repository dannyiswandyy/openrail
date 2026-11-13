//! Independent train.dat/train.xml metadata primitives.

use serde::{Deserialize, Serialize};
use std::{fs, path::Path};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TrainSpec {
    pub format: String,
    pub acceleration: Vec<f64>,
    pub brake_notches: usize,
    pub power_notches: usize,
    pub reverser_positions: usize,
    pub max_speed_mps: Option<f64>,
}

pub fn parse_train_dat(path: &str) -> Result<TrainSpec, String> {
    let text = fs::read_to_string(Path::new(path)).map_err(|e| e.to_string())?;
    let mut spec = TrainSpec { format: "train.dat".into(), ..Default::default() };
    let mut section = String::new();
    for raw in text.lines() {
        let line = raw.split(';').next().unwrap_or("").trim();
        if line.is_empty() { continue; }
        if let Some(s) = line.strip_prefix('#') { section = s.to_ascii_uppercase(); continue; }
        match section.as_str() {
            "ACCELERATION" => if let Ok(v) = line.parse::<f64>() { spec.acceleration.push(v); },
            "BRAKE" | "BRAKE_NOTCHES" => if let Ok(v) = line.parse::<usize>() { spec.brake_notches = v; },
            "POWER" | "POWER_NOTCHES" => if let Ok(v) = line.parse::<usize>() { spec.power_notches = v; },
            "REVERSER" => if let Ok(v) = line.parse::<usize>() { spec.reverser_positions = v; },
            _ => {}
        }
    }
    Ok(spec)
}
