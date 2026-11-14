# Rules for AI helpers working on OpenRail

OpenRail is Danny's Windows launcher and content manager for the OpenBVE train simulator. It's a Tauri 2 app: a React + TypeScript front end (`src/`, built with Vite) and a Rust back end (`src-tauri/`). Danny works on it with more than one AI (Claude, ChatGPT, Grok). Read this before changing anything, so you don't undo each other's work.

## Before you change anything

1. **Get the newest commit first.** Another AI may have pushed a minute ago. Pull or fetch `main` and build on top of it.
2. **Never force-push** and never reset `main`. If your push is rejected, fetch, put your change on top of the new commits, and push again.
3. **One change at a time.** CI cancels a run when a newer push comes in (`cancel-in-progress`), so a quick second push means the first one never finishes building.

## Where things live

| What | Where |
| --- | --- |
| Front end (screens, styles) | `src/` (`App.tsx`, `main.tsx`, `styles.css`) |
| Back end (files, OpenBVE, system calls) | `src-tauri/src/` |
| App name, version, window, security rules, installer | `src-tauri/tauri.conf.json` |
| Rust packages | `src-tauri/Cargo.toml` |
| JavaScript packages | `package.json` |
| Icon source | `src-tauri/icons/app-icon.svg` (CI makes the other icon sizes from it) |
| CI | `.github/workflows/build.yml`: web build, Rust tests, and the Windows installer |

## Versions

- Keep the Tauri versions matched: `@tauri-apps/api` and `@tauri-apps/cli` in `package.json`, and `tauri` / `tauri-build` in `Cargo.toml`, on the same 2.x release.
- Only use a version that has actually been published. Check npm or crates.io first. Several builds have failed on versions that don't exist.
- Keep the app version the same in `package.json`, `tauri.conf.json` and `Cargo.toml`.

## Before you push

1. `npm install && npm run build`: TypeScript must type-check and Vite must build.
2. `cargo test --manifest-path src-tauri/Cargo.toml`, if you changed Rust code and can run it.
3. Don't loosen the security rules (`csp` in `tauri.conf.json`, or `src-tauri/capabilities/`) unless Danny asks for it.

## After you push

- Wait for **OpenRail CI** to finish. The installer is the **OpenRail-Windows-x64** artifact on the run (kept 30 days).
- Tell Danny which run to download it from, and only after the run has passed.

## Content

- Use OpenBVE routes, trains and sounds only when the creators allow it, and credit them by name.

## Commit messages

Say what changed for Danny, in plain words. Say which AI you are in the commit or its trailer, so it's clear who did what.
