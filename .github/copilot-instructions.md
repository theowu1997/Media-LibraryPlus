# Project Guidelines

## Architecture
MLA+ is a Windows-first Electron desktop app built with Electron, React, TypeScript, Vite, better-sqlite3, and FFmpeg/FFprobe.

- Main process code lives in app/main/.
- The preload bridge lives in app/main/preload.ts.
- The renderer lives in app/renderer/src/ and is organized into components, hooks, and tests.
- Shared IPC contracts and domain types live in app/shared/contracts.ts.
- Business logic belongs in app/services/ and persistence belongs in app/database/database.ts.
- See README.md for product behavior and feature scope; do not duplicate it in code comments or instructions.

## Build And Test
- npm run dev starts the real development flow: initial tsc -b, TypeScript watch, Vite on 127.0.0.1:5173, then Electron.
- npm run build builds main and renderer output into dist/.
- npm test runs the Vitest suite. Renderer and integration-style tests live under app/renderer/src/__tests__/.
- npm run test:e2e builds the app and runs the Playwright suite in tests/.
- npm start launches Electron from built output and rebuilds better-sqlite3 for the Electron runtime first.

## Conventions
- Keep renderer code browser-safe. Do not import Node or Electron APIs into the renderer; go through window.desktopApi only.
- When adding or changing an IPC endpoint, update all three boundaries together: app/main/main.ts, app/main/preload.ts, and app/renderer/src/types.d.ts.
- Keep IPC channel names in domain:action form and reuse existing domains where possible.
- Treat app/shared/contracts.ts as the source of truth for request, response, and shared UI state shapes.
- Database rows may be stored in snake_case, but exported application types and IPC payloads should stay camelCase.
- Prefer extending existing hooks/components in app/renderer/src/hooks/ and app/renderer/src/components/ over adding more logic to App.tsx.
- Use CSS modules for component-scoped styling and keep global styling in app/renderer/src/styles.css minimal.
- Keep filesystem, FFmpeg, long-path, and other Windows-specific behavior in main-process services rather than duplicating it in UI code.

## Agent Notes
- Do not edit generated output in dist/, packaged artifacts, or dependency trees in node_modules/.
- Native module mismatches are common here: use npm run rebuild:node for Node/Vitest and npm run rebuild:electron for Electron runtime issues.
- The dev server URL is coupled between scripts/dev.cjs and app/main/main.ts; if one changes, the other must change with it.
- Scan progress is event-driven via scan:progress; preserve that pattern instead of adding polling.
- Subtitle generation depends on resources/subgen/ plus a local Python environment with the packages from resources/subgen/requirements.txt.
