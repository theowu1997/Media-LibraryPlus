import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { app, BrowserWindow, dialog, globalShortcut, ipcMain, protocol, shell } from "electron";
import { DatabaseClient } from "../database/database";
import { moveMovieToMode } from "../services/fileService";
import { DEFAULT_SCAN_OPTIONS, scanLibraries, createCancelToken, registerLocalFiles, type CancelToken } from "../services/libraryScanner";
import { extractVideoIdCandidates } from "../shared/videoId";
import { VIDEO_EXTENSIONS } from "../shared/contracts";
import { enrichMoviePoster } from "../services/metadataService";
import { runFfmpeg } from "../services/ffmpegService";
import type {
  AppShellState,
  MetadataSettings,
  LibraryMode,
  LibraryRoots,
  MovieRecord,
  OnlineSubtitleResult,
  OrganizationSettings,
  PlayerSettings,
  PosterBackfillSummary,
  ScanAutomationOptions,
  ScanMode,
  ScanProgress,
  ScanSummary,
  SubtitleScanResult
} from "../shared/contracts";

let mainWindow: BrowserWindow | null = null;
let database: DatabaseClient;
let gentleUnlocked = false;
let activeScanToken: CancelToken | null = null;

protocol.registerSchemesAsPrivileged([{
  scheme: "mla-media",
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    corsEnabled: true,
    stream: true
  }
}]);

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    title: "MLA+",
    backgroundColor: "#0f1217",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  if (rendererUrl) {
    void mainWindow.loadURL(rendererUrl);
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

function buildShellState(): AppShellState {
  return {
    version: app.getVersion(),
    platform: process.platform,
    gentleUnlocked,
    roots: database.getRoots(),
    subtitleDirs: database.getSubtitleDirs(),
    starterPinHint: database.getStarterPinHint(),
    metadataSettings: database.getMetadataSettings(),
    organizationSettings: database.getOrganizationSettings()
  };
}

function emitScanProgress(progress: ScanProgress): void {
  mainWindow?.webContents.send("scan:progress", progress);
}

function emptyScanSummary(scannedRoots?: LibraryRoots): ScanSummary {
  return {
    discovered: 0,
    imported: 0,
    skipped: 0,
    errors: [],
    invalidFiles: [],
    duplicateGroups: [],
    scannedRoots: scannedRoots ?? {
      normal: [],
      gentle: []
    },
    cancelled: true
  };
}

function buildCancelledProgress(mode: ScanMode): ScanProgress {
  return {
    stage: "cancelled",
    mode,
    currentRoot: null,
    currentFile: null,
    processedFiles: 0,
    totalFiles: 0,
    imported: 0,
    skipped: 0,
    message: "Folder selection was cancelled."
  };
}

function buildTranscodeOutputPath(sourcePath: string): string {
  const cacheDir = path.join(app.getPath("userData"), "player-cache");
  fs.mkdirSync(cacheDir, { recursive: true });
  const stat = fs.statSync(sourcePath);
  const baseName = path.basename(sourcePath, path.extname(sourcePath));
  const safeBase = baseName.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "video";
  const signature = `${stat.size}-${Math.floor(stat.mtimeMs)}`;
  return path.join(cacheDir, `${safeBase}-${signature}.mp4`);
}

function resolveTargetMode(options: ScanAutomationOptions): LibraryMode {
  if (options.addToNormalModeLibrary === options.addToGentleModeLibrary) {
    throw new Error("Select either Normal Mode library or Gentle Mode library.");
  }

  return options.addToGentleModeLibrary ? "gentle" : "normal";
}

function emptyPosterBackfillSummary(requested: number): PosterBackfillSummary {
  return {
    requested,
    updated: 0,
    skipped: 0,
    errors: []
  };
}

async function backfillMoviePosters(
  movieIds: string[],
  options?: {
    forceRefresh?: boolean;
  }
): Promise<PosterBackfillSummary> {
  const summary = emptyPosterBackfillSummary(movieIds.length);
  const metadataSettings = database.getMetadataSettings();
  const forceRefresh = options?.forceRefresh ?? false;

  for (let index = 0; index < movieIds.length; index += 1) {
    const movieId = movieIds[index];
    const movie = database.getMovie(movieId);
    if (!movie) {
      summary.skipped += 1;
      summary.errors.push(`${movieId} - Movie not found.`);
      continue;
    }

    if (movie.posterUrl && !forceRefresh) {
      summary.skipped += 1;
      continue;
    }

    emitScanProgress({
      stage: "processing",
      mode: "all",
      currentRoot: movie.folderPath,
      currentFile: movie.sourcePath,
      processedFiles: index,
      totalFiles: movieIds.length,
      imported: 0,
      skipped: summary.skipped,
      message: `Generating poster for ${movie.title}`
    });

    try {
      const posterUrl = await enrichMoviePoster(database, movie.id, metadataSettings, {
        forceRefresh,
        onProgress: emitScanProgress,
        progress: {
          stage: "processing",
          mode: "all",
          currentRoot: movie.folderPath,
          currentFile: movie.sourcePath,
          processedFiles: index,
          totalFiles: movieIds.length,
          imported: 0,
          skipped: summary.skipped,
          message: `Generating poster for ${movie.title}`
        }
      });

      if (posterUrl) {
        summary.updated += 1;
      } else {
        summary.skipped += 1;
      }
    } catch (error) {
      summary.skipped += 1;
      summary.errors.push(
        `${movie.sourcePath} - ${error instanceof Error ? error.message : "Poster backfill failed."}`
      );
    }
  }

  emitScanProgress({
    stage: "completed",
    mode: "all",
    currentRoot: null,
    currentFile: null,
    processedFiles: movieIds.length,
    totalFiles: movieIds.length,
    imported: summary.updated,
    skipped: summary.skipped,
    message: summary.updated > 0 ? "Poster backfill completed." : "Poster backfill finished."
  });

  return summary;
}

async function fetchSubtitleCatResults(query: string): Promise<OnlineSubtitleResult[]> {
  try {
    const url = `https://www.subtitlecat.com/index.php?search=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5"
      }
    });
    if (!response.ok) return [];
    const html = await response.text();
    const results: OnlineSubtitleResult[] = [];

    const rowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
    const rows = html.match(rowRegex) ?? [];

    for (const row of rows) {
      const pageLinkMatch = row.match(/href="(subs\/[^"]+\.html)"/i);
      if (!pageLinkMatch) continue;

      const detailUrl = `https://www.subtitlecat.com/${pageLinkMatch[1]}`;
      const downloadsMatch = row.match(/(\d+)\s+downloads?/i);
      const rowDownloads = downloadsMatch ? Number(downloadsMatch[1]) : 0;
      const rowTitleMatch = row.match(/<a[^>]+href="subs\/[^"]+\.html"[^>]*>([^<]+)<\/a>/i);
      const rowTitle = rowTitleMatch?.[1]?.trim() ?? query;

      try {
        const detailResponse = await fetch(detailUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5"
          }
        });
        if (!detailResponse.ok) continue;
        const detailHtml = await detailResponse.text();

        const detailMatches = Array.from(
          detailHtml.matchAll(
            /<a[^>]+id="download_([a-z]{2}(?:-[A-Z]{2})?)"[^>]+href="([^"]+\.srt[^"]*)"[^>]*>(?:Download)?<\/a>/gi
          )
        );

        for (const match of detailMatches) {
          const langCode = match[1].toLowerCase();
          const downloadUrl = match[2].startsWith("http")
            ? match[2]
            : `https://www.subtitlecat.com${match[2]}`;
          const language = languageLabelFromCode(langCode);
          const id = `${langCode}-${results.length}`;
          if (!results.some((r) => r.downloadUrl === downloadUrl)) {
            results.push({
              id,
              title: rowTitle,
              language,
              languageCode: langCode,
              downloadUrl,
              downloads: rowDownloads
            });
          }
        }
      } catch {
        // ignore failed detail page fetches
      }
    }

    return results.sort((a, b) => b.downloads - a.downloads || a.title.localeCompare(b.title)).slice(0, 30);
  } catch {
    return [];
  }
}

function languageLabelFromCode(code: string): string {
  const normalized = code.toLowerCase();
  if (normalized === "zh-hans") return "Chinese Simplified";
  if (normalized === "zh-hant" || normalized === "zh-tw") return "Chinese Traditional";
  if (normalized === "zh") return "Chinese";
  if (normalized === "en") return "English";
  if (normalized === "ja") return "Japanese";
  if (normalized === "ko") return "Korean";
  if (normalized === "es") return "Spanish";
  if (normalized === "fr") return "French";
  if (normalized === "de") return "German";
  if (normalized === "pt") return "Portuguese";
  if (normalized === "ar") return "Arabic";
  if (normalized === "ru") return "Russian";
  if (normalized === "it") return "Italian";
  return code.length > 0 ? code.toUpperCase() : "Unknown";
}

function registerHandlers(): void {
  ipcMain.handle("app:getState", async () => buildShellState());

  ipcMain.handle("settings:saveMetadata", async (_event, settings: MetadataSettings) => {
    database.setMetadataSettings(settings);
    return buildShellState();
  });

  ipcMain.handle(
    "settings:saveOrganization",
    async (_event, settings: OrganizationSettings) => {
      database.setOrganizationSettings(settings);
      return buildShellState();
    }
  );

  ipcMain.handle("movies:list", async (_event, args?: { query?: string; limit?: number; offset?: number }) => {
    return database.listMovies({
      includeGentle: gentleUnlocked,
      query: args?.query ?? "",
      limit: args?.limit ?? 200,
      offset: args?.offset ?? 0
    });
  });

  ipcMain.handle("movies:count", async (_event, args?: { query?: string }) => {
    return database.countMovies({
      includeGentle: gentleUnlocked,
      query: args?.query ?? ""
    });
  });

  // Always returns all movies from both modes — used for actress directory
  ipcMain.handle("movies:listAll", async () => {
    return database.listMovies({ includeGentle: true, query: "", limit: 99999, offset: 0 });
  });

  ipcMain.handle("movies:ensurePosters", async (_event, movieIds: string[]) => {
    const dedupedIds = Array.from(new Set(movieIds)).filter(Boolean);
    return backfillMoviePosters(dedupedIds);
  });

  ipcMain.handle("movies:refreshPosters", async (_event, movieIds: string[]) => {
    const dedupedIds = Array.from(new Set(movieIds)).filter(Boolean);
    return backfillMoviePosters(dedupedIds, {
      forceRefresh: true
    });
  });

  ipcMain.handle("movies:backfillPosters", async () => {
    const movieIds = database
      .listMovies({
        includeGentle: true,
        query: ""
      })
      .filter((movie) => !movie.posterUrl)
      .map((movie) => movie.id);

    return backfillMoviePosters(movieIds);
  });

  ipcMain.handle("movies:pickScan", async (_event, scanOptions: ScanAutomationOptions) => {
    const targetMode = resolveTargetMode(scanOptions);
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openDirectory", "createDirectory"]
    });

    if (result.canceled || result.filePaths.length === 0) {
      emitScanProgress(buildCancelledProgress(targetMode));
      return emptyScanSummary();
    }

    // The picked folder is the SOURCE — don't save it as a library root.
    // Files will be moved into the configured library path (from organization settings).
    // If no library path is configured, the source folder acts as the de-facto root.
    const rootsToScan: LibraryRoots =
      targetMode === "normal"
        ? { normal: result.filePaths, gentle: [] }
        : { normal: [], gentle: result.filePaths };

    activeScanToken = createCancelToken();
    try {
      return await scanLibraries(database, rootsToScan, {
        mode: targetMode,
        onProgress: emitScanProgress,
        scanOptions,
        cancelToken: activeScanToken
      });
    } finally {
      activeScanToken = null;
    }
  });

  ipcMain.handle("movies:scan", async (_event, options?: ScanAutomationOptions) => {
    activeScanToken = createCancelToken();
    try {
      return await scanLibraries(database, database.getRoots(), {
        mode: "all",
        onProgress: emitScanProgress,
        scanOptions: options ?? DEFAULT_SCAN_OPTIONS,
        cancelToken: activeScanToken
      });
    } finally {
      activeScanToken = null;
    }
  });

  ipcMain.handle("scan:cancel", () => {
    if (activeScanToken) {
      activeScanToken.cancelled = true;
    }
  });

  ipcMain.handle("library:addRoot", async (_event, mode: LibraryMode) => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openDirectory", "createDirectory"]
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const roots = database.getRoots();
      database.setRoots({
        ...roots,
        [mode]: [...roots[mode], ...result.filePaths]
      });
    }

    return buildShellState();
  });

  ipcMain.handle("settings:pickLibraryFolder", async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: "Choose library storage folder",
      properties: ["openDirectory", "createDirectory"]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle("shell:openFile", async (_event, filePath: string) => {
    await shell.openPath(filePath);
  });

  ipcMain.handle("shell:showInFolder", (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
  });

  ipcMain.handle(
    "movies:moveMode",
    async (_event, movieId: string, mode: LibraryMode) => {
      return moveMovieToMode(database, movieId, mode);
    }
  );

  ipcMain.handle(
    "movies:batchMoveMode",
    async (_event, movieIds: string[], mode: LibraryMode) => {
      const moved: MovieRecord[] = [];
      for (const movieId of movieIds) {
        moved.push(await moveMovieToMode(database, movieId, mode));
      }
      return moved;
    }
  );

  ipcMain.handle("auth:unlockGentle", async (_event, pin: string) => {
    if (!database.verifyGentlePin(pin)) {
      return {
        ok: false,
        message: "Incorrect PIN."
      };
    }

    gentleUnlocked = true;
    return {
      ok: true,
      message: "Gentle library unlocked for this session."
    };
  });

  ipcMain.handle("auth:toggleGentle", async () => {
    gentleUnlocked = !gentleUnlocked;
    return buildShellState();
  });

  ipcMain.handle("actress:getPhotos", async () => {
    return database.getAllActressPhotos();
  });

  ipcMain.handle("actress:refreshPhotos", async () => {
    const { enrichActressPhotos } = await import("../services/metadataService.js");
    const allMovies = database.listMovies({ includeGentle: true, query: "" });
    const names = new Set<string>();
    for (const movie of allMovies) {
      for (const name of movie.actresses) {
        if (name.trim()) names.add(name);
      }
    }
    await enrichActressPhotos(database, Array.from(names));
    return database.getAllActressPhotos();
  });

  ipcMain.handle("player:fetchSubtitles", async (_event, dvdId: string): Promise<OnlineSubtitleResult[]> => {
    return fetchSubtitleCatResults(dvdId);
  });

  ipcMain.handle("player:downloadSubtitle", async (_event, url: string): Promise<string | null> => {
    try {
      // file:// URLs must be read from disk — Node fetch() doesn't support the file: protocol
      if (url.startsWith("file:")) {
        const filePath = decodeURIComponent(url.replace(/^file:\/{2,3}/, "").replace(/\//g, path.sep));
        return fs.readFileSync(filePath, "utf8");
      }
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
      });
      if (!response.ok) return null;
      return await response.text();
    } catch {
      return null;
    }
  });

  ipcMain.handle("player:getSettings", () => {
    return database.getPlayerSettings();
  });

  ipcMain.handle("player:saveSettings", (_event, settings: PlayerSettings) => {
    database.setPlayerSettings(settings);
    return settings;
  });

  ipcMain.handle("player:getFileUrl", (_event, filePath: string, folderPath?: string | null): string => {
    const resolvedPath =
      path.isAbsolute(filePath)
        ? filePath
        : folderPath
          ? path.join(folderPath, filePath)
          : filePath;
    const fileUrl = pathToFileURL(path.resolve(resolvedPath)).href;
    return fileUrl.replace(/^file:/, "mla-media:");
  });

  ipcMain.handle("player:convertToMp4", async (_event, filePath: string): Promise<{ ok: boolean; url?: string; error?: string }> => {
    try {
      const outputPath = buildTranscodeOutputPath(filePath);
      if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
        await runFfmpeg([
          "-y",
          "-i",
          filePath,
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "23",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "aac",
          "-b:a",
          "192k",
          outputPath
        ]);
      }
      const fileUrl = pathToFileURL(outputPath).href;
      return { ok: true, url: fileUrl.replace(/^file:/, "mla-media:") };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown conversion error"
      };
    }
  });

  ipcMain.handle("actress:setPhoto", async (_event, actressName: string): Promise<Record<string, string>> => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: `Set photo for ${actressName}`,
      properties: ["openFile"],
      filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "webp", "gif"] }],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return database.getAllActressPhotos();
    }
    const sourcePath = result.filePaths[0];
    const photosDir = path.join(app.getPath("userData"), "actress-photos");
    fs.mkdirSync(photosDir, { recursive: true });
    const ext = path.extname(sourcePath).toLowerCase() || ".jpg";
    const safeName = actressName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const destPath = path.join(photosDir, `${safeName}${ext}`);
    fs.copyFileSync(sourcePath, destPath);
    database.setActressPhoto(actressName, `file:///${destPath.replace(/\\/g, "/")}`);
    return database.getAllActressPhotos();
  });

  // ── Subtitle directory management ──────────────────────────────────────────

  ipcMain.handle("subtitle:addDir", async (): Promise<AppShellState> => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openDirectory"],
      title: "Select Subtitle Directory",
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const dirs = database.getSubtitleDirs();
      const newDir = result.filePaths[0];
      if (!dirs.includes(newDir)) {
        database.setSubtitleDirs([...dirs, newDir]);
      }
    }
    return buildShellState();
  });

  ipcMain.handle("subtitle:removeDir", (_event, dir: string): AppShellState => {
    database.setSubtitleDirs(database.getSubtitleDirs().filter((d) => d !== dir));
    return buildShellState();
  });

  ipcMain.handle("subtitle:scan", async (): Promise<SubtitleScanResult> => {
    const subtitleDirs = database.getSubtitleDirs();
    const subtitleExts = new Set([".srt", ".vtt", ".ass", ".ssa"]);
    let total = 0, matched = 0, skipped = 0, unmatched = 0;

    const walkDir = async (dir: string): Promise<string[]> => {
      const files: string[] = [];
      try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            files.push(...await walkDir(fullPath));
          } else if (entry.isFile() && subtitleExts.has(path.extname(entry.name).toLowerCase())) {
            files.push(fullPath);
          }
        }
      } catch { /* skip unreadable dirs */ }
      return files;
    };

    // Extract language tag from subtitle filename, e.g. "IPX-787.en.srt" → "en"
    const extractLang = (subtitlePath: string): string => {
      const base = path.basename(subtitlePath, path.extname(subtitlePath));
      const parts = base.split(".");
      if (parts.length >= 2) {
        const last = parts[parts.length - 1];
        if (/^[a-z]{2,8}(-[A-Z]{2,4})?$/.test(last)) return last;
      }
      return "";
    };

    for (const dir of subtitleDirs) {
      for (const subtitlePath of await walkDir(dir)) {
        total++;
        const candidates = extractVideoIdCandidates(
          path.basename(subtitlePath, path.extname(subtitlePath))
        );
        let didMatch = false;

        for (const candidate of candidates) {
          const hit = database.getMovieByVideoId(candidate);
          if (!hit) continue;

          const fullMovie = database.getMovie(hit.id);
          if (!fullMovie?.sourcePath) { skipped++; didMatch = true; break; }

          const lang = extractLang(subtitlePath);
          const videoBasename = path.basename(fullMovie.sourcePath, path.extname(fullMovie.sourcePath));
          const videoDir = path.dirname(fullMovie.sourcePath);
          const subtitleExt = path.extname(subtitlePath).toLowerCase();
          const newFilename = lang ? `${videoBasename}.${lang}${subtitleExt}` : `${videoBasename}${subtitleExt}`;
          const newPath = path.join(videoDir, newFilename);

          let finalPath = subtitlePath;
          if (subtitlePath !== newPath) {
            try {
              await fs.promises.copyFile(subtitlePath, newPath);
              await fs.promises.unlink(subtitlePath);
              finalPath = newPath;
            } catch { /* keep original path if rename fails */ }
          }

          database.upsertSubtitle(hit.id, finalPath, lang || "unknown");
          matched++;
          didMatch = true;
          break;
        }

        if (!didMatch) unmatched++;
      }
    }

    return { total, matched, skipped, unmatched };
  });

  ipcMain.handle("movies:addFiles", async (): Promise<{ added: number; skipped: number }> => {
    const VIDEO_EXTS = VIDEO_EXTENSIONS.map((ext) => ext.slice(1)); // strip leading dot for dialog filter
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: "Add video files to library",
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "Video Files", extensions: VIDEO_EXTS }],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { added: 0, skipped: 0 };
    }

    return registerLocalFiles(database, result.filePaths);
  });

  ipcMain.handle("duplicates:resolve", async (_event, keepPath: string, deletePaths: string[], gentleUnlockedArg?: boolean): Promise<{ deleted: number; blocked: number }> => {
    const gentleRoots = database.getRoots().gentle.map((r) => r.replace(/\\/g, "/"));
    const isGentleFile = (p: string) => {
      const normalized = p.replace(/\\/g, "/");
      return gentleRoots.some((root) => normalized.startsWith(root));
    };

    let deleted = 0;
    let blocked = 0;

    for (const deletePath of deletePaths) {
      // Block physical deletion of gentle-library files when gentle is locked
      const gentle = isGentleFile(deletePath);
      if (gentle && !gentleUnlocked && !gentleUnlockedArg) {
        // Still remove DB record if present, but do NOT delete the file
        const movieId = database.findMovieIdBySourcePath(deletePath);
        if (movieId) database.deleteMovie(movieId);
        blocked += 1;
        continue;
      }

      const movieId = database.findMovieIdBySourcePath(deletePath);
      if (movieId) database.deleteMovie(movieId);

      try {
        await fs.promises.unlink(deletePath);
        deleted += 1;
      } catch { /* already gone or locked */ }
    }

    return { deleted, blocked };
  });
}

app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");
app.commandLine.appendSwitch("disable-http-cache");

app.whenReady().then(() => {
  const databasePath = path.join(app.getPath("userData"), "mla-plus.db");
  database = new DatabaseClient(databasePath);
  protocol.registerFileProtocol("mla-media", (request, callback) => {
    try {
      const parsed = new URL(request.url);
      let filePath: string;

      if (process.platform === "win32" && /^[a-z]$/i.test(parsed.hostname)) {
        const drive = `${parsed.hostname.toUpperCase()}:`;
        const normalizedPath = decodeURIComponent(parsed.pathname).replace(/\//g, path.sep);
        filePath = path.normalize(`${drive}${normalizedPath}`);
      } else if (process.platform === "win32" && /^\/[a-z]:/i.test(parsed.pathname)) {
        filePath = path.normalize(decodeURIComponent(parsed.pathname.slice(1)).replace(/\//g, path.sep));
      } else {
        const fileUrl = request.url.replace(/^mla-media:/, "file:");
        filePath = fileURLToPath(fileUrl);
      }

      callback({ path: filePath });
    } catch {
      callback({ error: -6 });
    }
  });
  registerHandlers();
  createWindow();

  // Register global shortcut for Ctrl+Shift+D → toggle gentle mode
  globalShortcut.register("CommandOrControl+Shift+D", () => {
    gentleUnlocked = !gentleUnlocked;
    mainWindow?.webContents.send("gentle:toggled", buildShellState());
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  globalShortcut.unregisterAll();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  database?.close();
});
