# Project Guidelines

## Architecture

MLA+ is a Windows-first desktop media library app built with Electron, React 19, TypeScript, Vite, better-sqlite3, and FFmpeg/FFprobe.

### Process boundaries

```
app/main/main.ts          ← Electron main process: IPC handlers, window management
app/main/preload.ts       ← contextBridge: exposes window.desktopApi to the renderer
app/renderer/src/         ← React UI (browser-safe; no Node/Electron imports)
app/services/             ← Business logic: scanner, ffmpeg, metadata, file ops
app/database/database.ts  ← SQLite via better-sqlite3 (synchronous, main-process only)
app/shared/contracts.ts   ← Single source of truth for all cross-process types
app/shared/             ← Also contains organizationTemplates.ts and videoId.ts
```

### Tauri migration (in progress)

A parallel Tauri runtime path exists in `src-tauri/` and `app/renderer/src/desktopApi.ts`. The renderer initialises the API at startup:

- If `window.__TAURI__` is present → `desktopApi.ts` builds a Tauri-backed API using `@tauri-apps/api`
- Otherwise → `preload.ts` has already injected `window.desktopApi` via Electron's contextBridge

Tauri commands use `snake_case` (e.g. `get_app_state`); Electron IPC channels use `domain:action` (e.g. `app:getState`). Methods not yet ported in the Tauri path return `unsupported(...)` — do not silently add stubs there without porting the backend logic.

### Data flow

IPC call → `window.desktopApi` → preload → `ipcMain.handle` → service layer → database/FFmpeg/filesystem → response back through same chain.

Scan progress is pushed from the main process via `ipcRenderer.send("scan:progress", payload)`; the renderer subscribes via `window.desktopApi.onScanProgress`. Never replace this with polling.

### Storage

- SQLite database lives in the Electron user-data directory at runtime (not in the repo).
- Rows are stored `snake_case`; all exported app types and IPC payloads are `camelCase`.
- `MovieRow` ↔ `MovieRecord` is the canonical example of this mapping in `database.ts`.

## Build and Test

```bash
npm run dev              # TypeScript watch + Vite on 127.0.0.1:5173 + Electron
npm run build            # tsc -b + vite build → dist/
npm start                # rebuild better-sqlite3 for Electron, then launch from dist/
npm test                 # rebuild better-sqlite3 for Node, then run Vitest
npm run test:e2e         # build + Playwright end-to-end suite in tests/
```

**Run a single test file:**
```bash
npx vitest run app/renderer/src/__tests__/utils.test.ts
```

**Type-check without building:**
```bash
npx tsc --project tsconfig.renderer.json --noEmit
npx tsc --project tsconfig.main.json --noEmit
```

The project has two independent tsconfigs:
- `tsconfig.renderer.json` — ESNext/Bundler modules, DOM types, covers `app/renderer/src/` and `app/shared/`
- `tsconfig.main.json` — CommonJS/Node modules, covers `app/main/`, `app/services/`, `app/database/`, `app/shared/`

CI runs both type-checks and `npm test` on every push/PR.

## Conventions

### IPC boundary — 5-file checklist

Every new or changed IPC endpoint touches all of these in the same commit:

1. `app/shared/contracts.ts` — add/update request and response types
2. `app/main/main.ts` — register `ipcMain.handle("domain:action", ...)`
3. `app/main/preload.ts` — add method to the `api` object
4. `app/renderer/src/types.d.ts` — extend the `Window["desktopApi"]` interface
5. `app/renderer/src/__tests__/` — add or update Vitest coverage

The prompt `/add-ipc.prompt.md` walks through this checklist step by step.

### Channel naming

Use `domain:action` for Electron IPC (e.g. `subtitle:listLanguages`, `movies:batchMoveMode`). Extend an existing domain before creating a new one.

### Renderer safety

Never import `node:*`, `electron`, or `better-sqlite3` in `app/renderer/src/`. All desktop functionality goes through `window.desktopApi`.

### Components and hooks

Prefer extending existing hooks in `app/renderer/src/hooks/` and components in `app/renderer/src/components/` over adding logic to `App.tsx`. Use co-located CSS modules (`.module.css`) for component-scoped styles; `styles.css` is for shared layout and global tokens only.

### Windows-specific behavior

Long-path support, retry logic for busy files, and copy/delete fallback when moves fail are already implemented in `app/services/fileService.ts`. Preserve these patterns; do not introduce naive `fs.rename` calls for library file operations.

### Native module rebuilds

`better-sqlite3` is a native module with separate build targets:
- `npm run rebuild:node` — for Node.js / Vitest
- `npm run rebuild:electron` — for the Electron runtime

If you see "invalid ELF header" or ABI mismatch errors, run the appropriate rebuild.

## Metadata and Poster Flow

All logic lives in `app/services/metadataService.ts`. Understanding the pipeline prevents accidentally bypassing guards or duplicating fetches.

### Poster resolution order (per movie)

1. **Early exit** — if the movie already has `posterSource === "web"` and `forceRefresh` is not set, return the cached URL immediately.
2. **Local** — look for `<video-stem>.poster.jpg` beside the video file. If absent, FFmpeg captures a frame at ≈18 % of duration (clamped to 12–180 s) and saves it there.
3. **Web** — only attempted when `MetadataSettings.autoFetchWebPosters` is `true`. Strategy order is controlled by `sourceProfile`:
   - `"auto"` / `"adult-first"` → JAVDatabase first, TMDB fallback
   - `"mainstream-first"` → TMDB first, JAVDatabase fallback
   - `"local-only"` → skip online entirely

### JAVDatabase fetching

- Movie metadata: `GET https://www.javdatabase.com/movies/<video-id-lowercase>/` — parses `og:image` for the poster and the `<title>` tag for actress names.
- Actress photos: `GET https://www.javdatabase.com/idols/<name-slug>/` — parses `og:image`. This is best-effort; errors are silently swallowed.
- Both are plain HTML scrapes — no API key required.

### TMDB fetching

Requires **both** `MetadataSettings.tmdbReadAccessToken` (non-empty) **and** `MetadataSettings.tmdbNonCommercialUse === true`. Either gate missing → TMDB is skipped entirely. The poster base URL (e.g. `https://image.tmdb.org/t/p/w500`) is fetched once from `/3/configuration` and cached for the process lifetime, keyed by token + language + region.

### Video ID extraction (`app/shared/videoId.ts`)

`extractVideoId(filename)` → returns the first `PREFIX-DIGITS[-SUFFIX]` match where the prefix is 2–10 letters and is not in the codec/quality exclusion lists. `FC2-PPV-NNNN` is special-cased. `expandVideoIdLookupCandidates(videoId)` also tries stripping a trailing letter variant (e.g. `ABC-123-C` → also tries `ABC-123`) when querying JAVDatabase.

Video ID is resolved at enrichment time from `movie.videoId` → filename → title, in that priority order.

### In-process caching

`onlineMovieMetadataCache` (a `Map`) caches positive and negative results for the process lifetime. The cache key encodes `sourceProfile`, TMDB flags, token, language, region, resolved video ID, normalised title, year, and source path. A restart clears it. Don't add persistence here without considering stale-token invalidation.

### Poster storage format

- `posterSource === "local"` → value is a `data:image/jpeg;base64,...` data URL (read from disk and base64-encoded at storage time).
- `posterSource === "web"` → value is the raw remote URL (TMDB CDN or javdatabase.com).
- `posterSource === "none"` → no poster found yet.

When writing new poster-related code, update `database.updateMoviePoster(id, url, source)` and keep the `posterSource` field accurate so the backfill logic can skip already-fetched entries.

## Tauri Backend (`src-tauri/`)

All Rust code is in the single file `src-tauri/src/main.rs`. It is a migration scaffold — not feature-complete.

### State model

`PersistedState` is the single serializable state struct. It is held in `AppStateStore { state: Mutex<PersistedState> }` and registered as a Tauri managed state on startup. Every mutation goes through the `with_state()` helper, which locks the mutex, runs the updater closure, saves to disk, and returns the result. State is written to `tauri-state.json` inside the OS app-config directory (`AppHandle::path().app_config_dir()`).

### Adding a Tauri command

1. Implement a `fn my_command(...)` with `#[tauri::command]`.
2. Add it to the `tauri::generate_handler![..., my_command]` list in `main()`.
3. Add the matching entry in `app/renderer/src/desktopApi.ts` (the `createTauriDesktopApi` function), calling `invoke<ReturnType>("my_command", { args })`.
4. Remove or replace the corresponding `unsupported(...)` stub.

### Naming conventions in Rust

- Command functions: `snake_case` (e.g. `get_app_state`). These become the Tauri command names.
- All structs use `#[serde(rename_all = "camelCase")]` so fields serialize to `camelCase` for the renderer without manual mapping.
- Keep Rust struct field names in `snake_case`; the serde attribute handles the wire format.

### Stub commands

Commands not yet ported return trivially empty values via named helpers (`empty_poster_summary`, `empty_playback_checkpoint`, `empty_online_subtitles`, `empty_string_list`, `empty_subtitle_scan_result`). `scan_libraries` and `list_movies` also return empty results. Do not build UI features that depend on these returning real data until the backend is ported.

### Events

Tauri events use URL-style namespacing: `gentle://unlock-result`, `scan://progress`. The renderer subscribes via `tauri.event.listen(...)` in `desktopApi.ts`. Match this convention for any new push events.

### Building the Tauri app

```bash
npm run tauri:dev    # Tauri dev mode (builds frontend first via beforeDevCommand)
npm run tauri:build  # Production bundle
npm run tauri:check  # Check Tauri prerequisites
```

Rust deps: `tauri 2.x`, `serde`, `serde_json`. No additional crates — keep the dependency footprint minimal unless a new port genuinely requires one.

## Subtitle Generation

Subtitle generation is handled by a Python subprocess, not in-process. The main process spawns `resources/subgen/generate_subtitles.py` and reads its JSON stdout.

### Script interface

```
python generate_subtitles.py \
  --input  <video-path>   \
  --output <srt-path>     \
  --model  small|medium|large-v3   \
  [--language <iso-code>]          \  # omit for auto-detect
  [--translate-to en|zh|km]        \  # triggers NLLB translation pass
  [--prompt <text>]                   # initial prompt for Whisper
```

Stdout on success: `{"output": "...", "detected_language": "ja", "output_language": "ja"}` — parsed into `SubtitleGenerationResult` in `contracts.ts`.

### Language mapping (`SubtitleGenerationLanguage` → script flags)

| Contract value     | `--language` | `--translate-to` |
|--------------------|-------------|-----------------|
| `"auto"`           | *(omitted)* | *(omitted)*     |
| `"translate-en"`   | *(omitted)* | `en`            |
| `"translate-zh"`   | *(omitted)* | `zh`            |
| `"translate-km"`   | *(omitted)* | `km`            |

### Python environment

Requires a local Python environment with the packages in `resources/subgen/requirements.txt`:

```
faster-whisper>=1.1.0,<2      # transcription (CPU, int8)
sentencepiece>=0.2,<1         # tokeniser (always required)
transformers>=4.46,<5         # only used when --translate-to is set
```

Translation uses `facebook/nllb-200-distilled-600M` downloaded by HuggingFace on first use. If `transformers` is not installed and `--translate-to` is passed, the script raises a `RuntimeError` with an actionable message.

The `resources/ffmpeg/` directory contains the FFmpeg/FFprobe binaries bundled with the app — do not replace them with system binaries in service code.

## Agent Notes

- Do not edit `dist/`, `dist_electron/`, `node_modules/`, or any generated build output.
- The Vite dev server port (5173) is hardcoded in both `vite.config.ts` and `app/main/main.ts`; change both together or neither.
- Subtitle generation requires `resources/subgen/` and a local Python environment matching `resources/subgen/requirements.txt`.
- The `app/renderer/src/desktopApi.ts` file doubles as the Tauri migration shim. Mark partially-ported commands with `unsupported(...)` rather than silently no-oping them.
