---
name: ipc-boundary-audit
description: "Audit IPC endpoint changes in MLA+ and verify all required boundary files are updated together. Use for: add IPC endpoint, modify IPC channel, desktopApi mismatch, preload/main/contracts drift, cross-process type drift, IPC checklist validation, and PR review of IPC changes."
---

# IPC Boundary Audit

Use this skill to verify that IPC-related work updates all required files and tests in one coherent change.

## When to use

- Added a new Electron IPC channel.
- Changed a request or response type crossing process boundaries.
- Updated preload or desktopApi without confirming contract alignment.
- Reviewing a PR that touches IPC, renderer desktopApi consumption, or shared contracts.

## Required boundary checklist

For any IPC endpoint add/change, verify all applicable files are updated:

1. app/shared/contracts.ts
2. app/main/main.ts
3. app/main/preload.ts
4. app/renderer/src/types.d.ts
5. app/renderer/src/__tests__/ (or tests covering changed behavior)

Also verify channel naming follows domain:action.

## Audit procedure

1. Identify changed IPC channels and affected desktopApi methods.
2. Confirm shared request/response types in app/shared/contracts.ts are the source of truth.
3. Confirm ipcMain.handle registration exists and signatures align in app/main/main.ts.
4. Confirm preload forwards each endpoint correctly in app/main/preload.ts.
5. Confirm renderer window typing includes the same method shape in app/renderer/src/types.d.ts.
6. Confirm tests cover the changed behavior at the appropriate level.
7. Report missing boundary updates as explicit findings with file paths.

## Output format

Return findings ordered by severity:

- Critical: behavior-breaking IPC mismatch or missing boundary file update.
- High: incorrect type alignment likely to break at runtime.
- Medium: missing/weak tests for changed IPC behavior.
- Low: naming or consistency issues.

If no issues are found, state: "No IPC boundary findings." and list residual risks or testing gaps.

## Scope notes

- Prefer focused checks over broad refactors.
- Do not edit generated artifacts (dist, dist_electron, node_modules, src-tauri/target, src-tauri/gen).
- If a change is Tauri-only, verify it is explicitly scoped and does not silently diverge from Electron IPC contracts.
- Workspace hooks may ask for confirmation on single-boundary edits or boundary edits without detected test-path updates.
- If IPC_GUARD_OK is used to bypass a guard ask, treat it as an explicit exception and require the rationale to be stated in the review notes.
