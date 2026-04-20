# MediaLibrary Plus

MediaLibrary Plus is a Windows desktop app for organizing and browsing local video libraries, with a focus on JAV collections. It scans folders, filters supported video files, generates poster-based browsing views, organizes files into Normal and Gentle Mode workspaces, and provides a built-in player with subtitle support.

## What the app does

- Scans local folders for video files
- Filters supported media before importing
- Builds a browsable video library with poster cards
- Organizes content into Normal Mode and Gentle Mode
- Moves and renames video files using configurable templates
- Groups imported titles by actress
- Plays videos inside the app with subtitle search and local subtitle loading
- Manages library roots, subtitle folders, poster generation, and player preferences from Settings
- Supports TMDB title-based metadata fallback when the non-commercial use checkbox is enabled

## Main screens

![Build](https://img.shields.io/badge/build-passing-brightgreen)
![Platform](https://img.shields.io/badge/platform-Windows-blue)
![License](https://img.shields.io/badge/license-MIT-green)

### Home

- Start scans for Normal Mode or Gentle Mode
- Choose scan options before import
- Import only complete files
- Prefer better-quality files when duplicates are found
- Convert supported media to MP4 during import
- Move and rename files during import
- Auto-match local subtitle files during scanning
- Resolve long paths during organization
- Import directly into Normal Mode or Gentle Mode

### Library

- Browse all imported titles as poster cards
- Switch between Normal Mode and Gentle Mode collections
- Batch select multiple titles
- Move selected videos between modes
- Regenerate posters for selected titles
- Select titles missing poster images
- Sort the library by actress, import date, DVD ID, recent additions, oldest, and newest
- Zoom the card grid in and out for denser or larger browsing

### Actresses

- View the library grouped by actress
- See actress profile images when available
- Refresh actress photos
- Open a context menu for actress profile actions
- Browse titles for a selected actress
- Filter actress browsing by Normal Mode, Gentle Mode, or all titles
- Adjust the actress card grid density

### Player

- Play imported videos inside the app
- Seek backward and forward with mouse and buttons
- Switch to fullscreen
- Control volume, mute, and playback speed
- Play the next or previous title in the library
- Load local subtitle files
- Search SubtitleCat by video ID or title
- Filter online subtitle search results by language
- Download and apply subtitles while watching
- Remember playback position when enabled in settings

### Settings

- Set Normal Mode and Gentle Mode library roots
- Choose library storage folders
- Configure the Gentle Mode unlock shortcut
- Set movie renaming and folder structure templates
- Configure subtitle folders and subtitle scanning
- Adjust player defaults like volume, subtitle size, and subtitle color
- Manage metadata poster settings
- Paste your TMDB v4 read access token in `Settings > Web posters > TMDB v4 read access token`
- Configure TMDB usage under its free non-commercial terms and attribution requirement
- Use light/dark app styling from the interface

## How the library works

- The app scans local video files from configured roots
- It validates files before import
- It prefers complete and higher-quality files when duplicates exist
- It parses video IDs and metadata from filenames
- It can fetch posters and actress metadata from online sources
- TMDB fallback is optional and requires explicit non-commercial use acknowledgment
- It generates local poster frames when needed
- It stores library records in a local SQLite database
- It keeps Normal Mode and Gentle Mode collections separate

## Library organization

MediaLibrary Plus uses configurable naming templates so imported files can be moved into a consistent folder structure. The app can organize files by title, actress, year, video ID, and other tokens defined in Settings.

Typical behavior:

- Scan local media
- Parse metadata from filenames
- Determine the target mode
- Move and rename the video
- Move matching subtitle files
- Write library metadata files where configured
- Clean up empty folders after moves

## Subtitle support

- Auto-match local subtitle files during import
- Import subtitle files from configured subtitle directories
- Search online subtitles from SubtitleCat
- Download subtitles in the selected language
- Apply downloaded subtitles in the built-in player

## Gentle Mode

Gentle Mode is protected by a shortcut-based unlock flow.

- Default unlock shortcut: `Ctrl+Alt+D`
- Unlock applies to the current app session
- Gentle Mode content stays separate from Normal Mode content
- Gentle files are only fully accessible after unlock

## Development

```bash
npm install
npm run dev
```

## Scripts

 - `npm run dev` – Start the Electron development flow
 - `npm run build` – Type-check and build the app
 - `npm start` – Launch the packaged Electron app
 - `npm test` – Run the Vitest unit suite
 - `npm run test:e2e` – Run the Playwright end-to-end suite

## Troubleshooting

- If Git commands fail with a worktree path error, see [docs/git-repair.md](docs/git-repair.md).
- For native module errors (e.g., better-sqlite3), run `npm run rebuild:electron`.

## Contributing

Contributions are welcome! Please open issues or pull requests for bug fixes, features, or documentation improvements.

1. Fork the repo and create a feature branch.
2. Make your changes and add tests if applicable.
3. Run `npm test` to ensure all tests pass.
4. Submit a pull request with a clear description.

---

## Notes

- MLA+ is Windows-first and uses Electron, React, Vite, and better-sqlite3.
- The local database is stored in the Electron user-data directory.
- Metadata and poster fetching rely on online services and may fail if those services are unavailable.
- TMDB usage is intended for free non-commercial projects with attribution.
- Some UI features may be partial or roadmap-only.
## Git troubleshooting

If Git commands fail with a worktree path error (broken `.git` pointer), see `docs/git-repair.md`.

## Notes

- The app is Windows-first and uses Electron
- It stores its local database in the Electron user-data directory
- Metadata and poster fetching rely on online services and can fail if those services are unavailable
- TMDB usage is intended for free non-commercial projects with attribution
- Some UI items described in the product vision may still be partial or roadmap-only
