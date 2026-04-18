---
description: "Use when editing Electron main process code, preload bridge code, services, database logic, file operations, scan workflows, or shared IPC contracts. Covers IPC boundaries, Windows-specific behavior, and native/runtime constraints."
name: "Main Process Guidelines"
applyTo:
  - "app/main/**"
  - "app/services/**"
  - "app/database/**"
  - "app/shared/contracts.ts"
---

# Main Process Guidelines

- Keep Node, Electron, database, filesystem, FFmpeg, and path-handling logic in the main process or services, not in the renderer.
- For every IPC addition or signature change, update `app/main/main.ts`, `app/main/preload.ts`, `app/renderer/src/types.d.ts`, and any affected shared contract types together.
- Keep IPC channel names in `domain:action` form and prefer extending existing domains before inventing new ones.
- Use `app/shared/contracts.ts` for request and response shapes that cross process boundaries.
- Preserve Windows-safe file handling patterns already used in services: long-path support, retry logic for busy files, and copy/delete fallback behavior when moves fail.
- Database access stays synchronous and main-process only through `better-sqlite3`. Keep exported app-facing data in `camelCase` even if storage remains `snake_case`.
- When changing scan, subtitle, or poster workflows, preserve progress/event semantics so renderer hooks continue to work without polling.
- Be careful with runtime-specific dependencies: `npm run rebuild:node` is for Node/Vitest, and `npm run rebuild:electron` is for Electron runtime issues.