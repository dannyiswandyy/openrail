# OpenRail Phase 1 — Platform Foundation

OpenRail is being developed toward an openOMSI-style platform for OpenBVE: a modern launcher/content manager first, with a clean path toward a future independent simulator engine.

## Delivered in Phase 1

- OpenBVE installation detection and manual selection.
- Recursive Railway/Train content discovery.
- Route/train metadata extraction and image previews.
- Persistent library, favourites and recent drives.
- Launch profiles: route, train, station, start time, AI and display settings.
- Conservative route health validation for missing file-like dependencies.
- Dedicated Validator UI and warning counts.
- Local-only content handling: OpenRail does not upload user content.
- Tauri CSP enabled instead of a null policy.
- Rust backend kept modular so future engine services can be added without replacing the launcher.

## Compatibility rule

Phase 1 never replaces or modifies OpenBVE content. It only reads content, validates it conservatively, and launches the installed OpenBVE executable.

## Next engine-facing layers

1. Content manifest/index and dependency graph.
2. OpenBVE parser compatibility library.
3. Route/track scene graph.
4. Train model, cab, sound and animation systems.
5. Signalling, timetable, AI and physics.
6. Independent renderer and simulator runtime.

The long-term target is to run compatible OpenBVE content through OpenRail itself, without requiring the original OpenBVE executable, while keeping the compatibility layer clean-room and independently implemented.
