---
description: "Use to add a new desktopApi IPC endpoint (Electron main, preload, renderer typing, and UI). Follows MLA+ conventions for channel naming, contract typing, and test coverage."
name: "Add desktopApi IPC endpoint"
---

# Add a new desktopApi IPC endpoint

Follow this checklist for every new desktopApi method or IPC channel:

1. **Define the contract**
   - Add or update the request/response types in `app/shared/contracts.ts`.
2. **Register the handler**
   - In `app/main/main.ts`, add an `ipcMain.handle("domain:action", ...)` handler for the new endpoint.
3. **Expose in preload**
   - In `app/main/preload.ts`, add a method to the `api` object that calls `ipcRenderer.invoke("domain:action", ...)`.
4. **Type the renderer**
   - In `app/renderer/src/types.d.ts`, extend the `desktopApi` interface on `Window` with the new method and its types.
5. **Update the UI**
   - In the relevant React component or hook, call the new `window.desktopApi` method.
6. **Test**
   - Add or update Vitest coverage in `app/renderer/src/__tests__/` for the new UI/IPC flow.

## Example prompt usage

> /add-ipc.prompt "Add a desktopApi endpoint to fetch all subtitle languages for a movie by ID."

This will:
- Add types to `contracts.ts`
- Register the handler in `main.ts`
- Expose the method in `preload.ts`
- Extend `desktopApi` in `types.d.ts`
- Add a UI call in the relevant component
- Add or update a test

**Channel naming:** Use `domain:action` (e.g., `subtitle:listLanguages`).
**Keep all boundaries in sync.**