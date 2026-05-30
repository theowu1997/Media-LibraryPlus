# MLA+ Agent Instructions

Use this file as a quick orientation only. Keep behavior-specific details in scoped instruction files and prompts.

## Start Here

- Architecture and runtime boundaries:
  - [Main process guidance](.github/instructions/main-process.instructions.md)
  - [Renderer guidance](.github/instructions/renderer.instructions.md)
  - [Testing guidance](.github/instructions/tests.instructions.md)
- Common workflow prompts:
  - [Add desktopApi IPC endpoint](.github/prompts/add-ipc.prompt.md)
  - [Audit IPC boundary changes](.github/prompts/audit-ipc-boundary.prompt.md)
- Reusable workflow skill:
  - [IPC boundary audit skill](.github/skills/ipc-boundary-audit/SKILL.md)
- Task-focused subagent:
  - [MLA+ Agent](.github/agents/mla-plus.agent.md)
  - [IPC Auditor](.github/agents/ipc-auditor.agent.md)
- Workspace hook automation:
  - [IPC boundary reminder hook](.github/hooks/ipc-boundary-reminder.json)
  - [IPC boundary guard script](scripts/hooks/ipc-boundary-guard.ps1) (asks on single-boundary edits and when no test-path updates are detected)
  - Intentional exception token: include IPC_GUARD_OK in the prompt/tool context to bypass guard asks for one-off, justified cases
  - [IPC guard workflow documentation](docs/ipc-guard-workflow.md)

## Core Rules (Always Apply)

- Respect process boundaries.
  - Renderer code in [app/renderer/src](app/renderer/src) must be browser-safe and use window.desktopApi for desktop access.
  - Node, Electron, filesystem, FFmpeg, and better-sqlite3 logic stays in [app/main](app/main), [app/services](app/services), or [app/database](app/database).
- Keep IPC boundaries in sync whenever adding or changing an endpoint.
  - Update [app/shared/contracts.ts](app/shared/contracts.ts), [app/main/main.ts](app/main/main.ts), [app/main/preload.ts](app/main/preload.ts), [app/renderer/src/types.d.ts](app/renderer/src/types.d.ts), and relevant tests in [app/renderer/src/__tests__](app/renderer/src/__tests__).
- Preserve event-driven scan behavior.
  - Do not replace scan progress events with polling.
- Treat Tauri migration as explicit work.
  - In [app/renderer/src/desktopApi.ts](app/renderer/src/desktopApi.ts), keep unported methods as unsupported(...) unless backend commands are implemented in [src-tauri/src/main.rs](src-tauri/src/main.rs).
- Avoid generated output edits.
  - Do not edit [dist](dist), [dist_electron](dist_electron), [node_modules](node_modules), [src-tauri/target](src-tauri/target), or [src-tauri/gen](src-tauri/gen).

## Validation Expectations

- Run focused tests for changed behavior first, then broader suites when needed.
- For renderer or IPC-facing changes, include or update Vitest coverage under [app/renderer/src/__tests__](app/renderer/src/__tests__).
- Use Playwright tests under [tests](tests) for cross-process desktop flows.

## Notes

- This repository snapshot does not expose a root package manifest in the current workspace view. Prefer confirming task-local scripts before introducing new command assumptions.