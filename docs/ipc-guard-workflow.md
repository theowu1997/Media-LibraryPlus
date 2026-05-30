# IPC Guard Workflow

This document explains the workspace hook behavior that protects IPC boundary changes from drifting across process boundaries.

## Where it is configured

- Hook config: [.github/hooks/ipc-boundary-reminder.json](../.github/hooks/ipc-boundary-reminder.json)
- Reminder script: [scripts/hooks/ipc-boundary-reminder.ps1](../scripts/hooks/ipc-boundary-reminder.ps1)
- Guard script: [scripts/hooks/ipc-boundary-guard.ps1](../scripts/hooks/ipc-boundary-guard.ps1)

## Events and behavior

1. `UserPromptSubmit`
- The reminder script injects an IPC checklist message when prompt text looks IPC-related.

2. `PreToolUse`
- The guard script asks for confirmation when a mutating tool input appears to edit IPC boundary files in risky ways.

## What triggers a guard ask

The guard asks when at least one IPC boundary path is detected in the tool input and either condition is true:

1. Only one boundary file is detected:
- `app/shared/contracts.ts`
- `app/main/main.ts`
- `app/main/preload.ts`
- `app/renderer/src/types.d.ts`

2. No test-path update is detected under:
- `app/renderer/src/__tests__/`
- `tests/`

## Bypass token for intentional exceptions

Use `IPC_GUARD_OK` in prompt/tool context only for explicit one-off exceptions.

When this token is used:
- The guard skips the ask.
- The change should include a clear rationale in PR description or review notes.

## Recommended workflow

1. Make IPC changes using the 5-file boundary checklist.
2. Include focused test updates when behavior changes.
3. Use `IPC_GUARD_OK` only when intentionally doing a partial boundary change and document why.
4. Run validation before PR:
- `npm run build`
- `npm test`
- `npm run test:e2e` (when cross-process behavior is involved)
