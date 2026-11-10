# OpenRail

OpenRail is an open-source desktop launcher and content manager for OpenBVE.

## v1.0 foundation

- Modern launcher UI
- OpenBVE executable detection
- Manual executable selection
- Recursive route/train scanner
- Route and train library
- Real OpenBVE launch command
- Basic validator/warning surface
- Native folder/file dialogs
- Rendering roadmap with DLSS kept disabled until engine-side integration is real

## Development

```bash
npm install
npm run dev
```

For a Tauri desktop build, install the Tauri prerequisites for your platform and run the standard Tauri CLI workflow.

## Design principle

OpenRail does not pretend to provide DLSS. DLSS/FSR/XeSS support will only be exposed once the actual OpenBVE rendering path has a compatible integration.
