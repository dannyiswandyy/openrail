# OpenRail

OpenRail is being built as an **openOMSI-style platform for OpenBVE**: a modern launcher and content manager today, with an independent Rust simulation engine designed to eventually run compatible OpenBVE content without the original executable.

## What is in the repository now

- Modern Tauri 2 + React 19 desktop shell.
- OpenBVE installation detection and real launching.
- Recursive Railway/Train content library.
- Route/train metadata and image previews.
- Persistent favourites and recent drives.
- Route dependency/health validation.
- Secure explicit Tauri CSP.
- Independent engine contracts for simulation state, route scenes, signals and train state.
- Independent CSV/RW route parsing primitives.
- Independent train.dat metadata parsing primitives.
- Renderer-agnostic scene graph and simulation loop primitives.

## Compatibility target

OpenRail targets the documented OpenBVE ecosystem rather than copying OpenBVE implementation code. The official documentation describes CSV routes as command streams with namespaces and track positions, and train.dat as section-based train definitions. OpenRail's compatibility layer is being implemented independently around those documented formats.

The eventual runtime target is:

**OpenBVE content → OpenRail compatibility layer → scene/physics/signalling/audio systems → native renderer → OpenRail simulator**

The launcher remains useful even before the native engine is complete, and can still launch the original OpenBVE executable.

## Long-term engine surface

- CSV/RW route parsing
- B3D/CSV/ANIMATED and supported legacy object ingestion
- train.dat/train.xml/panel/sound loading
- route scene graph
- train physics and braking
- signalling, ATS/ATC and timetable systems
- AI trains
- cab controls and instrumentation
- audio and animation
- native modern renderer
- developer/content validation tools
- optional compatibility boundaries for legacy plugins

## Important

OpenRail does **not** bundle OpenBVE, copy OpenBVE source code, or redistribute third-party routes/trains. Users supply their own simulator/content.

The native renderer is intentionally a separate engineering layer: it cannot be honestly represented as "DLSS support" or a complete simulator until a real graphics backend and runtime are implemented.
