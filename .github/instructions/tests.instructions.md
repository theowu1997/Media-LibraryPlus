---
description: "Use when writing or updating Vitest, integration tests, or Playwright coverage for MLA+. Covers where tests live, which commands to run, and how to choose the right level of test."
name: "Testing Guidelines"
applyTo:
  - "app/renderer/src/__tests__/**"
  - "tests/**"
---

# Testing Guidelines

- Use `npm test` for Vitest coverage and `npm run test:e2e` for Playwright coverage.
- Keep renderer and integration-style tests under `app/renderer/src/__tests__/`.
- Keep Electron end-to-end coverage under `tests/`.
- Prefer the smallest test that covers the behavior you changed: utility or hook tests first, then component tests, then Playwright only when the flow depends on Electron or cross-process behavior.
- When changing IPC-backed behavior, test the boundary that actually changed instead of asserting only on unrelated UI details.
- Avoid tests that depend on external services, real media libraries, or machine-specific filesystem state unless the fixture is already in the repo.