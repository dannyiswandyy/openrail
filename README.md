# OpenRail

OpenRail is a from-scratch, OMSI-inspired launcher and content manager for OpenBVE.

## v0.2

- Real Tauri/Rust command boundary
- OpenBVE executable detection
- Recursive content scanner for common route/train markers
- Route and train library views
- Folder selection through the native dialog
- Launch selected OpenBVE route/train
- Validator foundation
- Rendering roadmap with a strict rule: never claim DLSS is active unless the engine actually uses it

## Architecture

The launcher is intentionally separated from the future renderer work. DLSS/FSR/XeSS integration belongs in an engine-side rendering layer, not a fake launcher setting.

## Build

Install Node.js and Rust/Tauri prerequisites, then run `npm install` and `npm run build` for the web UI. For the desktop application use the Tauri CLI (`tauri dev` / `tauri build`).
