---
description: "Audit IPC boundary changes in the current diff or a target area. Verifies contracts, main handler, preload bridge, renderer typing, and tests stay in sync."
name: "Audit IPC boundary changes"
---

# Audit IPC boundary changes

Run a focused review for IPC consistency using the MLA+ boundary checklist.

## What this prompt checks

1. Shared contracts in app/shared/contracts.ts
2. IPC handlers in app/main/main.ts
3. Preload bridge methods in app/main/preload.ts
4. Renderer desktopApi typing in app/renderer/src/types.d.ts
5. Tests in app/renderer/src/__tests__/ or tests

It also checks channel naming consistency with domain:action.

## How to use

Use this prompt with either:

- No argument: audit recent or in-progress IPC edits.
- A target argument: audit a specific endpoint, domain, or file area.

## Example prompt usage

- /audit-ipc-boundary.prompt
- /audit-ipc-boundary.prompt "Review subtitle:listLanguages boundary alignment"
- /audit-ipc-boundary.prompt "Audit IPC changes under app/main and app/shared/contracts.ts"

## Expected output

Return findings ordered by severity:

- Critical: missing boundary file update or breaking mismatch.
- High: type/signature drift likely to break runtime behavior.
- Medium: missing or weak tests for changed IPC behavior.
- Low: naming or consistency cleanups.

If no issues are found, return: No IPC boundary findings. Include any residual risks or testing gaps.

## Scope

Keep this as an audit workflow. Do not perform unrelated refactors.

## Hook interplay

- The workspace PreToolUse guard may ask for confirmation on single-boundary edits or boundary edits without test-path updates.
- If IPC_GUARD_OK appears, treat it as an intentional exception and verify the reason is explicitly documented in the review output.
