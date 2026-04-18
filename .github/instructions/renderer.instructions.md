---
description: "Use when editing React UI, hooks, renderer state, CSS modules, or desktopApi consumers in app/renderer/src. Covers renderer-safe boundaries, component patterns, and styling conventions."
name: "Renderer Guidelines"
applyTo: "app/renderer/src/**"
---

# Renderer Guidelines

- Keep renderer code browser-safe. Access Electron functionality only through `window.desktopApi`.
- Prefer extending existing components in `app/renderer/src/components/` and hooks in `app/renderer/src/hooks/` before adding new top-level state to `App.tsx`.
- Treat `app/shared/contracts.ts` as the source of truth for UI-facing types instead of redefining payload shapes in the renderer.
- When a UI change needs new desktop functionality, update the IPC boundary in the same task rather than leaving partial renderer stubs.
- Use co-located CSS modules for component-scoped styling. Keep `app/renderer/src/styles.css` for shared layout and global tokens only.
- Match existing React patterns: functional components, hooks, async handlers with explicit status updates, and shared logic extracted into hooks or utilities when it is reused.
- Preserve scan and player flows as event-driven UI. Do not replace `scan:progress` listeners or player state sync with polling.
- Add or update Vitest coverage in `app/renderer/src/__tests__/` when renderer behavior changes materially.