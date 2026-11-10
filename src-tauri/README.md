# Tauri/Rust core

The native layer owns filesystem scanning, OpenBVE process management, validation, persistence and future renderer integration.

The renderer/upscaler layer must never claim DLSS is active unless the engine actually invokes the NVIDIA SDK/API.
