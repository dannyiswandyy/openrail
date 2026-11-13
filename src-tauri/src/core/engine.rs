//! OpenRail independent engine core.
//!
//! This module is deliberately renderer-agnostic. It provides the simulation-side
//! contracts needed to eventually run OpenBVE content without spawning OpenBVE.
//! It does not copy OpenBVE implementation code or assets.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct EngineConfig {
    pub tick_hz: u32,
    pub max_fps: u32,
    pub headless: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TrackState {
    pub position_m: f64,
    pub speed_mps: f64,
    pub curve_radius_m: f64,
    pub gradient: f64,
    pub cant_mm: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TrainState {
    pub position_m: f64,
    pub speed_mps: f64,
    pub acceleration_mps2: f64,
    pub power_notch: i32,
    pub brake_notch: i32,
    pub reverser: i8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Station {
    pub name: String,
    pub position_m: f64,
    pub arrival: Option<String>,
    pub departure: Option<String>,
    pub doors: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RouteScene {
    pub length_m: f64,
    pub stations: Vec<Station>,
    pub track: Vec<TrackState>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Signal {
    pub position_m: f64,
    pub aspect: u8,
    pub speed_limit_mps: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct EngineSnapshot {
    pub simulation_time_s: f64,
    pub train: TrainState,
    pub active_signal: Option<Signal>,
}

#[derive(Debug, Clone)]
pub struct SimulationEngine {
    pub config: EngineConfig,
    pub scene: RouteScene,
    pub train: TrainState,
    pub signals: Vec<Signal>,
    pub time_s: f64,
}

impl SimulationEngine {
    pub fn new(config: EngineConfig, scene: RouteScene) -> Self {
        Self { config, scene, train: TrainState::default(), signals: Vec::new(), time_s: 0.0 }
    }

    pub fn step(&mut self, dt_s: f64) {
        let dt = dt_s.clamp(0.0, 0.25);
        // Engine-side physics contract: power and braking are intentionally
        // conservative until train.dat/train.xml coefficients are loaded.
        let power = (self.train.power_notch.max(0) as f64) * 0.08;
        let brake = (self.train.brake_notch.max(0) as f64) * 0.18;
        let drag = self.train.speed_mps * 0.012;
        self.train.acceleration_mps2 = (power - brake - drag).clamp(-4.0, 3.0);
        self.train.speed_mps = (self.train.speed_mps + self.train.acceleration_mps2 * dt).max(0.0);
        self.train.position_m += self.train.speed_mps * dt;
        self.time_s += dt;
    }

    pub fn active_signal(&self) -> Option<Signal> {
        self.signals.iter()
            .filter(|s| s.position_m >= self.train.position_m)
            .min_by(|a,b| a.position_m.partial_cmp(&b.position_m).unwrap_or(std::cmp::Ordering::Equal))
            .cloned()
    }

    pub fn snapshot(&self) -> EngineSnapshot {
        EngineSnapshot {
            simulation_time_s: self.time_s,
            train: self.train.clone(),
            active_signal: self.active_signal(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneObject {
    pub asset: String,
    pub position: [f64; 3],
    pub rotation: [f64; 3],
    pub scale: [f64; 3],
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SceneGraph {
    pub objects: Vec<SceneObject>,
}

impl SceneGraph {
    pub fn push(&mut self, object: SceneObject) { self.objects.push(object); }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn engine_moves_train() {
        let mut e = SimulationEngine::new(EngineConfig::default(), RouteScene::default());
        e.train.power_notch = 5;
        e.step(1.0);
        assert!(e.train.speed_mps > 0.0);
        assert!(e.train.position_m > 0.0);
    }
}
