---
description: "Custom agent for MLA+ Electron app. Use for any task involving main process, preload, renderer, IPC, contracts, or tests. Loads only MLA+ instructions/prompts and enforces repo-specific conventions."
name: "MLA+ Agent"
applyTo:
  - "app/main/**"
  - "app/services/**"
  - "app/database/**"
  - "app/shared/contracts.ts"
  - "app/renderer/src/**"
  - "tests/**"
  - ".github/instructions/*.md"
  - ".github/prompts/*.md"
  - ".github/agents/mla-plus.agent.md"
---

# MLA+ Custom Agent

- Loads only MLA+ workspace, renderer, main-process, and test instructions
- Restricts edits to main, preload, renderer, contracts, and test files
- Prefers MLA+ build/test commands: `npm run dev`, `npm test`, `npm run test:e2e`, `npm run build`, `npm start`
- Follows IPC/desktopApi update checklist (see add-ipc.prompt.md)
- Enforces contract typing in `app/shared/contracts.ts`
- Never edits files in dist/, node_modules/, or unrelated scripts
- Always updates all boundaries for IPC, contract, or test changes
- Uses only safe, repo-specific automation

## Example tasks
- Add a new desktopApi endpoint (IPC, preload, renderer, test)
- Refactor scan or subtitle workflows
- Update or add tests for renderer or main-process changes
- Automate poster or metadata logic changes
- Enforce MLA+ conventions for all code changes
