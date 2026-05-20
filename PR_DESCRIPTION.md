# Scan Overflow and Library Stability Fixes

## Summary
Fixes a Windows scan crash caused by recursive directory traversal on deep or cyclic trees, then hardens library navigation, poster rendering, and scan monitoring so the app stays usable during and after large scans.

## What changed

### Scan workflow
- `app/services/libraryScanner.ts`:
  - Replaced recursive folder walking with an iterative traversal stack
  - Added visited-directory tracking using resolved paths to avoid symlink/junction loops
  - Preserves warnings instead of blowing the call stack on deep roots such as `K:\`

### Library navigation
- `app/renderer/src/components/AppSidebar.tsx`:
  - Removed the disable rule that blocked `Library` and `Search` when no visible titles were loaded
- `app/renderer/src/hooks/useLibrary.ts`:
  - Removed the forced redirect back to `Home` when a library query returned zero rows

### Poster rendering
- `app/renderer/src/components/PosterVisual.tsx`:
  - Normalizes legacy/local poster URLs into valid image sources
  - Falls back cleanly if an image fails to load
- `app/renderer/src/components/LibraryPage.tsx`:
  - Added a one-click `Rehydrate visible missing posters` action for currently visible tiles

### Real-time scan monitor
- `app/shared/contracts.ts`:
  - Added scan monitor tuning settings
- `app/renderer/src/scanMonitorSettings.ts`:
  - Added local persistence and validation for monitor tuning
- `app/renderer/src/hooks/useScanProgress.ts`:
  - Added elapsed time, ETA, throughput, and stall detection
  - Made the monitor sensitivity configurable
- `app/renderer/src/components/SettingsPage.tsx`:
  - Added UI controls to save/reset monitor tuning

### UX cleanup
- `app/renderer/src/components/ScanToast.tsx`
- `app/renderer/src/components/AppTopBar.tsx`
- `app/renderer/src/styles.css`
- `app/renderer/src/App.tsx`
  - Updated monitor surfaces and removed remaining inline-style diagnostics introduced during the UI refresh

## Validation

### Type-check / diagnostics
- Verified the touched files report no errors after the scan and renderer fixes.

### Runtime
- Confirmed `npm run dev` starts cleanly and the watcher stays at `Found 0 errors` after HMR updates.

## Notes
- The scan overflow fix is the primary functional change on this branch.
- The other renderer updates keep the app usable when library data is sparse, posters are missing, or scan progress is slow.
