# Tauri Migration

This repository now includes an initial Tauri host alongside the existing Electron app.

## What is migrated

- The renderer can now initialize a `window.desktopApi` bridge from either Electron preload or Tauri.
- A minimal Tauri backend exists under `src-tauri/`.
- Boot-critical commands are implemented so the React app can start under Tauri with persisted shell state.
- The current Tauri slice preserves the existing renderer contract instead of rewriting the UI.

## What is still pending

- SQLite, FFmpeg, scanner, subtitle generation, and file-organization logic are still Electron/Node implementations.
- Library scans and subtitle actions currently return scaffold responses under Tauri.
- Native validation was not completed in this workspace because the Rust toolchain is not installed.

## Commands

```bash
npm install
npm run tauri:dev
```

For builds:

```bash
npm run tauri:build
```

## Next migration steps

1. Port the database layer from `better-sqlite3` to Rust `rusqlite` or another Tauri-compatible storage layer.
2. Port scan/file operations from `app/services/` into Rust commands.
3. Replace scaffold commands in `src-tauri/src/main.rs` with real implementations.
4. Remove Electron-specific startup paths after the Tauri backend reaches feature parity.