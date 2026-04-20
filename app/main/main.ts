import path from "node:path";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, dialog, ipcMain, shell, globalShortcut } from "electron";
import { DatabaseClient } from "../database/database";
import { moveMovieToMode } from "../services/fileService";
import { buildTargetNfoPath, buildTargetSubtitlePath } from "../services/libraryLayout";
import { DEFAULT_SCAN_OPTIONS, scanLibraries, createCancelToken, type CancelToken } from "../services/libraryScanner";
import { enrichMoviePoster } from "../services/metadataService";
import { SUBTITLE_EXTENSIONS } from "../shared/contracts";
import { extractVideoIdCandidates } from "../shared/videoId";
import type {
  AppShellState,
  MetadataSettings,
  LibraryMode,
  LibraryRoots,
  MovieRecord,
  MoveProgress,
  OnlineSubtitleResult,
  OrganizationSettings,
  PlayerSettings,
  PosterBackfillSummary,
  ScanAutomationOptions,
  ScanMode,
  ScanProgress,
  ScanSummary,
  SubtitleGenerationOptions,
  SubtitleGenerationResult
} from "../shared/contracts";

let mainWindow: BrowserWindow | null = null;
let database: DatabaseClient;
let gentleUnlocked = false;
let activeScanToken: CancelToken | null = null;
// Track the currently registered gentle shortcut
let registeredGentleShortcut: string | null = null;
let lastGentleToggleAt = 0;
let terminalLoggingAvailable = true;

function writeTerminalLine(line: string, stream: NodeJS.WriteStream = process.stdout): void {
  if (!terminalLoggingAvailable) {
    return;
  }

  try {
    if (stream.destroyed || !stream.writable) {
      terminalLoggingAvailable = false;
      return;
    }

    stream.write(`${line}\n`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException | undefined)?.code === "EPIPE") {
      terminalLoggingAvailable = false;
      return;
    }

    throw error;
  }
}

async function cleanupDirectoryIfEmpty(directory: string): Promise<void> {
  const remaining = await fs.readdir(directory).catch(() => null);
  if (!remaining) {
    return;
  }

  const realEntries = remaining.filter(
    (entry) => entry !== "Thumbs.db" && entry !== "desktop.ini" && entry !== ".DS_Store"
  );
  if (realEntries.length === 0) {
    await fs.rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function deleteMovieArtifacts(movie: MovieRecord): Promise<void> {
  await fs.unlink(movie.sourcePath).catch(() => undefined);

  for (const subtitle of movie.subtitles) {
    await fs.unlink(subtitle.path).catch(() => undefined);
  }

  const nfoPath = buildTargetNfoPath(movie.folderPath, {
    libraryMode: movie.libraryMode,
    title: movie.title,
    year: movie.year,
    videoId: movie.videoId,
    actresses: movie.actresses,
    modelName: null,
    resolveLongPath: true,
    organizationSettings: database.getOrganizationSettings()
  });
  await fs.unlink(nfoPath).catch(() => undefined);
  await cleanupDirectoryIfEmpty(movie.folderPath);
}

function broadcastGentleState(message: string): void {
  mainWindow?.show();
  mainWindow?.focus();
  mainWindow?.webContents.send("gentle:unlockResult", {
    ok: true,
    message
  });
}

function toggleGentleUnlocked(reason: string): boolean {
  gentleUnlocked = !gentleUnlocked;
  broadcastGentleState(
    gentleUnlocked
      ? `Gentle library enabled for this session (${reason}).`
      : `Gentle library disabled for this session (${reason}).`
  );
  return gentleUnlocked;
}

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

  // Forward renderer console messages to the main process terminal for debugging
  mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    const levelName = level === 0 ? "LOG" : level === 1 ? "WARNING" : level === 2 ? "ERROR" : `LVL${level}`;
    writeTerminalLine(`[renderer:${levelName}] ${message} (${sourceId}:${line})`);
  });

  // Also log unhandled renderer crashes
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    writeTerminalLine(
      `[renderer:CRASH] Reason=${details.reason} exitCode=${details.exitCode}`,
      process.stderr
    );
  });

  // Register gentle mode unlock shortcut after window is ready
  mainWindow.once("ready-to-show", () => {
    registerGentleUnlockShortcut();
  });
}
function registerGentleUnlockShortcut() {
  if (!mainWindow) return;
  // Unregister previous shortcut if any
  if (registeredGentleShortcut) {
    globalShortcut.unregister(registeredGentleShortcut);
    registeredGentleShortcut = null;
  }
  const shortcut = database.getGentleShortcut().trim() || "Ctrl+Alt+D";
  if (shortcut && shortcut.length > 0) {
    const ok = globalShortcut.register(shortcut, async () => {
      const now = Date.now();
      if (now - lastGentleToggleAt < 350) {
        return;
      }
      lastGentleToggleAt = now;
      toggleGentleUnlocked("shortcut");
    });
    if (ok) registeredGentleShortcut = shortcut;
  }
}

function buildShellState(): AppShellState {
  return {
    version: app.getVersion(),
    platform: process.platform,
    gentleUnlocked,
    themeMode: database.getThemeMode(),
    roots: database.getRoots(),
    starterPinHint: database.getStarterPinHint(),
    metadataSettings: database.getMetadataSettings(),
    organizationSettings: database.getOrganizationSettings(),
    subtitleDirs: database.getSubtitleDirs(),
    scanHistory: database.getScanHistory()
  };
}

function emitScanProgress(progress: ScanProgress): void {
  mainWindow?.webContents.send("scan:progress", progress);
}

function emitMoveProgress(progress: MoveProgress): void {
  mainWindow?.webContents.send("move:progress", progress);
}

function emptyScanSummary(scannedRoots?: LibraryRoots): ScanSummary {
  return {
    discovered: 0,
    imported: 0,
    skipped: 0,
    errors: [],
    subtitleSearchLogs: [],
    invalidFiles: [],
    scannedRoots: scannedRoots ?? {
      normal: [],
      gentle: []
    },
    duplicateGroups: [],
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

function resolveTargetMode(options: ScanAutomationOptions): LibraryMode {
  if (options.addToNormalModeLibrary === options.addToGentleModeLibrary) {
    throw new Error("Select either Normal Mode library or Gentle Mode library.");
  }

  return options.addToGentleModeLibrary ? "gentle" : "normal";
}

function normalizeRootList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return [value];
  }

  return [];
}

function emptyPosterBackfillSummary(requested: number): PosterBackfillSummary {
  return {
    requested,
    updated: 0,
    skipped: 0,
    errors: []
  };
}

function resolveSubGenScriptPath(): string {
  return path.join(app.getAppPath(), "resources", "subgen", "generate_subtitles.py");
}

function resolveBuiltinPerformersPath(): string {
  return path.join(app.getAppPath(), "resources", "builtin-performers.json");
}

async function readBuiltinPerformers(): Promise<Array<{ name: string; country?: string; photoUrl?: string | null }>> {
  try {
    const filePath = resolveBuiltinPerformersPath();
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    const result: Array<{ name: string; country?: string; photoUrl?: string | null }> = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const record = entry as Record<string, unknown>;
      const name = typeof record.name === "string" ? record.name.trim() : "";
      if (!name) {
        continue;
      }
      const country = typeof record.country === "string" ? record.country.trim() : undefined;
      const photoUrl =
        record.photoUrl === null
          ? null
          : typeof record.photoUrl === "string"
            ? record.photoUrl.trim()
            : undefined;
      result.push({ name, country, photoUrl });
    }
    return result;
  } catch {
    return [];
  }
}

function buildSubGenSetupMessage(detail?: string): string {
  const suffix = detail ? ` ${detail}` : "";
  return `Sub-Gen needs a working Python install plus the local subtitle-model packages from resources/subgen/requirements.txt, then try again.${suffix}`;
}

function sanitizeSubtitleFileName(value: string): string {
  const withoutExtension = value.replace(/\.srt$/i, "").trim();
  const sanitized = withoutExtension.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();
  return sanitized || "subtitle";
}

async function runSubtitleGeneration(movie: MovieRecord, options: SubtitleGenerationOptions): Promise<SubtitleGenerationResult> {
  const scriptPath = resolveSubGenScriptPath();
  try {
    await fs.access(scriptPath);
  } catch {
    return {
      ok: false,
      message: buildSubGenSetupMessage("The generator script was not found."),
      subtitlePath: null,
      detectedLanguage: null,
      outputLanguage: null,
      setupRequired: true
    };
  }

  const targetPath = buildTargetSubtitlePath({
    directory: movie.folderPath,
    title: movie.title,
    year: movie.year,
    videoId: movie.videoId,
    actresses: movie.actresses,
    modelName: movie.videoId?.split("-")[0] ?? null,
    language:
      options.language === "translate-en"
        ? "en"
        : options.language === "translate-zh"
          ? "zh"
          : options.language === "translate-km"
            ? "km"
          : "und",
    extension: ".srt",
    subtitleCount: Math.max(movie.subtitles.length + 1, 1),
    resolveLongPath: true,
    organizationSettings: database.getOrganizationSettings()
  });
  const finalTargetPath =
    options.outputMode === "output-srt"
      ? path.join(movie.folderPath, "output.srt")
      : options.outputMode === "custom-name"
        ? path.join(movie.folderPath, `${sanitizeSubtitleFileName(options.customFileName ?? "")}.srt`)
      : targetPath;

  const args = [scriptPath, "--input", movie.sourcePath, "--output", finalTargetPath, "--model", options.model];
  if (options.language === "translate-en") {
    args.push("--translate-to", "en");
  } else if (options.language === "translate-zh") {
    args.push("--translate-to", "zh");
  } else if (options.language === "translate-km") {
    args.push("--translate-to", "km");
  }

  return new Promise<SubtitleGenerationResult>((resolve) => {
    const child = spawn("python", args, {
      cwd: app.getAppPath(),
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      resolve({
        ok: false,
        message: buildSubGenSetupMessage(error.message),
        subtitlePath: null,
        detectedLanguage: null,
        outputLanguage: null,
        setupRequired: true
      });
    });
    child.on("close", (code) => {
      if (code !== 0) {
        const lowered = `${stdout}\n${stderr}`.toLowerCase();
        const setupRequired = lowered.includes("no module named") || lowered.includes("python was not found") || lowered.includes("not recognized");
        resolve({
          ok: false,
          message: setupRequired ? buildSubGenSetupMessage(stderr.trim() || stdout.trim()) : (stderr.trim() || stdout.trim() || `Subtitle generation failed with exit code ${code}.`),
          subtitlePath: null,
          detectedLanguage: null,
          outputLanguage: null,
          setupRequired
        });
        return;
      }

      try {
        const payload = JSON.parse(stdout.trim()) as {
          output: string;
          detected_language?: string | null;
          output_language?: string | null;
        };
        const detectedLanguage = payload.detected_language?.trim() || "und";
        const outputLanguage =
          payload.output_language?.trim() ||
          (options.language === "translate-en"
            ? "en"
            : options.language === "translate-zh"
              ? "zh"
              : options.language === "translate-km"
                ? "km"
              : detectedLanguage);
        database.upsertSubtitle(movie.id, payload.output, outputLanguage);
        resolve({
          ok: true,
          message: `Subtitle generated at ${payload.output}`,
          subtitlePath: payload.output,
          detectedLanguage,
          outputLanguage,
          setupRequired: false
        });
      } catch {
        resolve({
          ok: false,
          message: stderr.trim() || "Subtitle generation completed but returned invalid output.",
          subtitlePath: null,
          detectedLanguage: null,
          outputLanguage: null,
          setupRequired: false
        });
      }
    });
  });
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

async function collectSubtitleFiles(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
  const subtitleFiles: string[] = [];

  for (const entry of entries) {
    const resolved = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      subtitleFiles.push(...(await collectSubtitleFiles(resolved)));
      continue;
    }

    if (
      entry.isFile() &&
      SUBTITLE_EXTENSIONS.includes(path.extname(entry.name).toLowerCase() as (typeof SUBTITLE_EXTENSIONS)[number])
    ) {
      subtitleFiles.push(resolved);
    }
  }

  return subtitleFiles;
}

function findMovieForSubtitle(subtitlePath: string): { id: string; title: string } | null {
  const subtitleName = path.basename(subtitlePath, path.extname(subtitlePath));
  for (const candidate of extractVideoIdCandidates(subtitleName)) {
    const movie = database.getMovieByVideoId(candidate);
    if (movie) {
      return movie;
    }
  }

  return null;
}

async function scanSubtitleDirectories(): Promise<{
  total: number;
  matched: number;
  skipped: number;
  unmatched: number;
}> {
  const subtitleDirs = database.getSubtitleDirs();
  let total = 0;
  let matched = 0;
  let skipped = 0;
  let unmatched = 0;

  for (const subtitleDir of subtitleDirs) {
    const subtitleFiles = await collectSubtitleFiles(subtitleDir);
    total += subtitleFiles.length;

    for (const subtitleFile of subtitleFiles) {
      const movie = findMovieForSubtitle(subtitleFile);
      if (!movie) {
        unmatched += 1;
        continue;
      }

      const alreadyLinked =
        database.getMovie(movie.id)?.subtitles.some((subtitle) => subtitle.path === subtitleFile) ?? false;
      database.upsertSubtitle(movie.id, subtitleFile, "und");

      if (alreadyLinked) {
        skipped += 1;
      } else {
        matched += 1;
      }
    }
  }

  return { total, matched, skipped, unmatched };
}

async function fetchSubtitleCatResults(query: string): Promise<OnlineSubtitleResult[]> {
  async function searchOnce(q: string): Promise<OnlineSubtitleResult[]> {
    const url = `https://www.subtitlecat.com/index.php?search=${encodeURIComponent(q)}`;
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

    const languageNames: Record<string, string> = {
      af: "Afrikaans",
      ar: "Arabic",
      bn: "Bengali",
      de: "German",
      en: "English",
      es: "Spanish",
      fr: "French",
      hi: "Hindi",
      id: "Indonesian",
      it: "Italian",
      ja: "Japanese",
      jw: "Javanese",
      km: "Cambodian",
      ko: "Korean",
      ms: "Malay",
      pt: "Portuguese",
      ru: "Russian",
      ta: "Tamil",
      th: "Thai",
      tl: "Filipino",
      tr: "Turkish",
      ur: "Urdu",
      vi: "Vietnamese",
      zh: "Chinese",
      "zh-cn": "Chinese (Simplified)",
      "zh-tw": "Chinese (Traditional)"
    };

    const linkRegex = /href="(\/subs\/\d+\/([^"/]+?)-([a-z]{2}(?:-[a-z]{2})?)\.srt)"/gi;
    for (const match of html.matchAll(linkRegex)) {
      const rawUrl = match[1];
      const rawTitle = decodeURIComponent(match[2] ?? q);
      const rawLanguageCode = (match[3] ?? "und").toLowerCase();
      const normalizedLanguageCode =
        rawLanguageCode === "zh-cn" || rawLanguageCode === "zh-tw"
          ? rawLanguageCode
          : rawLanguageCode.slice(0, 2);
      const title = rawTitle.replace(/[-_.]+/g, " ").trim() || q;
      const language = languageNames[rawLanguageCode] ?? languageNames[normalizedLanguageCode] ?? rawLanguageCode.toUpperCase();
      const downloadUrl = `https://www.subtitlecat.com${rawUrl}`;
      const id = `${normalizedLanguageCode}-${results.length}`;

      if (!results.some((r) => r.downloadUrl === downloadUrl)) {
        results.push({
          id,
          title,
          language,
          languageCode: normalizedLanguageCode,
          downloadUrl,
          downloads: 0
        });
      }
    }

    const normalizedQuery = q.toUpperCase();
    return results
      .filter((result) => {
        const normalizedTitle = result.title.toUpperCase();
        return normalizedTitle.includes(normalizedQuery) || normalizedQuery.includes(normalizedTitle);
      })
      .sort((left, right) => right.downloads - left.downloads || left.title.localeCompare(right.title))
      .slice(0, 30);
  }
  try {
    let results = await searchOnce(query);
    if (results.length === 0 && query !== query.toUpperCase()) {
      results = await searchOnce(query.toUpperCase());
    }
    return results;
  } catch {
    return [];
  }
}

function registerHandlers(): void {
    ipcMain.handle("settings:getGentleShortcut", async () => {
      return database.getGentleShortcut();
    });

  ipcMain.handle("settings:setGentleShortcut", async (_event, shortcut: string) => {
    database.setGentleShortcut(shortcut);
    registerGentleUnlockShortcut();
    return true;
  });

  ipcMain.handle("gentle:toggle", async () => {
    toggleGentleUnlocked("button");
    return buildShellState();
  });

  ipcMain.handle("settings:verifyGentlePin", async (_event, pin: string) => {
    const ok = database.verifyGentlePin(pin);
    const message = ok
      ? "Gentle library unlocked with PIN."
      : "Incorrect PIN.";

    if (ok) {
      gentleUnlocked = true;
      broadcastGentleState(message);
    }

    return { ok, message };
  });

  ipcMain.handle("settings:getThemeMode", async () => {
    return database.getThemeMode();
  });

  ipcMain.handle("settings:setThemeMode", async (_event, themeMode: "dark" | "light") => {
    database.setThemeMode(themeMode);
    return buildShellState();
  });

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

    const currentRoots = database.getRoots();
    const nextRoots = {
      ...currentRoots,
      [targetMode]: Array.from(
        new Set([
          ...normalizeRootList(currentRoots[targetMode]),
          ...result.filePaths
        ])
      )
    };
    database.setRoots(nextRoots);

    const rootsToScan: LibraryRoots =
      targetMode === "normal"
        ? { normal: result.filePaths, gentle: [] }
        : { normal: [], gentle: result.filePaths };

    activeScanToken = createCancelToken();
    try {
      const summary = await scanLibraries(database, rootsToScan, {
        mode: targetMode,
        onProgress: emitScanProgress,
        scanOptions,
        cancelToken: activeScanToken
      });
      if (!summary.cancelled) {
        database.appendScanHistory(summary);
      }
      return summary;
    } finally {
      activeScanToken = null;
    }
  });

  ipcMain.handle("movies:scan", async (_event, options?: ScanAutomationOptions) => {
    activeScanToken = createCancelToken();
    try {
      const summary = await scanLibraries(database, database.getRoots(), {
        mode: "all",
        onProgress: emitScanProgress,
        scanOptions: options ?? DEFAULT_SCAN_OPTIONS,
        cancelToken: activeScanToken
      });
      if (!summary.cancelled) {
        database.appendScanHistory(summary);
      }
      return summary;
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
        [mode]: Array.from(
          new Set([
            ...normalizeRootList(roots[mode]),
            ...result.filePaths
          ])
        )
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

  ipcMain.handle("subtitle:addDir", async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: "Choose subtitle folder",
      properties: ["openDirectory", "createDirectory"]
    });

    if (!result.canceled && result.filePaths.length > 0) {
      database.setSubtitleDirs([
        ...database.getSubtitleDirs(),
        ...result.filePaths
      ]);
    }

    return buildShellState();
  });

  ipcMain.handle("subtitle:removeDir", async (_event, dir: string) => {
    database.setSubtitleDirs(
      database.getSubtitleDirs().filter((entry) => entry !== dir)
    );
    return buildShellState();
  });

  ipcMain.handle("subtitle:scan", async () => {
    return scanSubtitleDirectories();
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
      emitMoveProgress({
        stage: "starting",
        targetMode: mode,
        totalMovies: 1,
        completedMovies: 0,
        currentMovieId: movieId,
        message: "Starting move..."
      });
      try {
        const moved = await moveMovieToMode(database, movieId, mode, {
          onProgress: (update) => {
            emitMoveProgress({
              stage: update.stage,
              targetMode: mode,
              totalMovies: 1,
              completedMovies: 0,
              currentMovieId: movieId,
              message: update.message
            });
          }
        });
        emitMoveProgress({
          stage: "completed",
          targetMode: mode,
          totalMovies: 1,
          completedMovies: 1,
          currentMovieId: movieId,
          message: "Move complete."
        });
        return moved;
      } catch (error) {
        emitMoveProgress({
          stage: "error",
          targetMode: mode,
          totalMovies: 1,
          completedMovies: 0,
          currentMovieId: movieId,
          message: "Move failed.",
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }
    }
  );

  ipcMain.handle(
    "movies:batchMoveMode",
    async (_event, movieIds: string[], mode: LibraryMode) => {
      const moved: MovieRecord[] = [];
      const total = movieIds.length;
      let completed = 0;
      emitMoveProgress({
        stage: "starting",
        targetMode: mode,
        totalMovies: total,
        completedMovies: 0,
        currentMovieId: null,
        message: `Starting batch move (${total} movies)...`
      });
      for (const movieId of movieIds) {
        const movie = database.getMovie(movieId);
        emitMoveProgress({
          stage: "moving",
          targetMode: mode,
          totalMovies: total,
          completedMovies: completed,
          currentMovieId: movieId,
          message: `Moving ${completed + 1}/${total}: ${movie?.title ?? movieId}`
        });
        const updated = await moveMovieToMode(database, movieId, mode, {
          onProgress: (update) => {
            emitMoveProgress({
              stage: update.stage,
              targetMode: mode,
              totalMovies: total,
              completedMovies: completed,
              currentMovieId: movieId,
              message: update.message
            });
          }
        });
        moved.push(updated);
        completed += 1;
        emitMoveProgress({
          stage: completed === total ? "completed" : "moving",
          targetMode: mode,
          totalMovies: total,
          completedMovies: completed,
          currentMovieId: movieId,
          message: completed === total ? "Batch move complete." : `Moved ${completed}/${total}.`
        });
      }
      return moved;
    }
  );

  ipcMain.handle(
    "duplicates:resolve",
    async (_event, keepPath: string, deletePaths: string[], gentleUnlocked?: boolean) => {
      let deleted = 0;
      let blocked = 0;
      for (const p of deletePaths) {
        try {
          const movieId = database.findMovieIdBySourcePath(p);
          const movie = movieId ? database.getMovie(movieId) : null;

          if (movie && movie.libraryMode === "gentle" && !gentleUnlocked) {
            blocked += 1;
            continue;
          }

          if (movieId && movie) {
            await deleteMovieArtifacts(movie);
            database.deleteMovie(movieId);
          } else if (movieId) {
            database.deleteMovie(movieId);
          } else {
            await fs.unlink(p).catch(() => undefined);
          }

          deleted += 1;
        } catch (error) {
          // ignore individual delete errors but proceed
          // eslint-disable-next-line no-console
          console.error(`Failed to delete duplicate ${p}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      return { deleted, blocked };
    }
  );

  ipcMain.handle("actress:getPhotos", async () => {
    return database.getAllActressPhotos();
  });

  ipcMain.handle("actress:getRegions", async () => {
    return database.getActressRegions();
  });

  ipcMain.handle("actress:getRegion", async (_event, name: string) => {
    return database.getActressRegion(name);
  });

  ipcMain.handle("actress:listPhotos", async (_event, name: string) => {
    return database.getActressPhotos(name);
  });

  ipcMain.handle("actress:refreshPhotos", async () => {
    const { enrichActressPhotos } = await import("../services/metadataService");
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

  ipcMain.handle("actress:setPhoto", async (_event, name: string) => {
    // Let the user pick an image file and store a file:// URL in DB
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: `Choose photo for ${name}`,
      properties: ["openFile"],
      filters: [
        { name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return database.getAllActressPhotos();
    }

    const picked = result.filePaths[0];
    const normalized = picked.replace(/\\/g, "/");
    const url = `file:///${normalized}`;
    database.addActressPhoto(name, url);
    database.setActressPhoto(name, url);
    return database.getAllActressPhotos();
  });

  ipcMain.handle("actress:setRegion", async (_event, name: string, region: string) => {
    database.setActressRegion(name, region);
    return database.getActressRegions();
  });

  ipcMain.handle("actress:removePhoto", async (_event, name: string, photoUrl?: string) => {
    database.removeActressPhoto(name, photoUrl);
    return database.getAllActressPhotos();
  });

  ipcMain.handle("actress:setPrimaryPhoto", async (_event, name: string, photoUrl: string) => {
    database.setPrimaryActressPhoto(name, photoUrl);
    return database.getAllActressPhotos();
  });

  ipcMain.handle("performers:listBuiltin", async () => {
    return readBuiltinPerformers();
  });

  ipcMain.handle("player:fetchSubtitles", async (_event, dvdId: string): Promise<OnlineSubtitleResult[]> => {
    return fetchSubtitleCatResults(dvdId);
  });

  ipcMain.handle("player:downloadSubtitle", async (_event, url: string): Promise<string | null> => {
    try {
      if (url.startsWith("file://")) {
        const subtitlePath = fileURLToPath(url);
        return await fs.readFile(subtitlePath, "utf8");
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

  ipcMain.handle(
    "player:installSubtitle",
    async (_event, movieId: string, language: string, content: string): Promise<string> => {
      const movie = database.getMovie(movieId);
      if (!movie) {
        throw new Error("Movie not found.");
      }

      const targetPath = buildTargetSubtitlePath({
        directory: movie.folderPath,
        title: movie.title,
        year: movie.year,
        videoId: movie.videoId,
        actresses: movie.actresses,
        modelName: movie.videoId?.split("-")[0] ?? null,
        language,
        extension: ".srt",
        subtitleCount: Math.max(movie.subtitles.length + 1, 1),
        resolveLongPath: true,
        organizationSettings: database.getOrganizationSettings()
      });

      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, content, "utf8");
      database.upsertSubtitle(movieId, targetPath, language);
      return targetPath;
    }
  );

  ipcMain.handle("player:getSettings", () => {
    return database.getPlayerSettings();
  });

  ipcMain.handle("player:saveSettings", (_event, settings: PlayerSettings) => {
    database.setPlayerSettings(settings);
    return settings;
  });

  ipcMain.handle("player:getPlaybackCheckpoint", (_event, movieId: string) => {
    return database.getPlaybackCheckpoint(movieId);
  });

  ipcMain.handle("player:savePlaybackCheckpoint", (_event, movieId: string, positionSeconds: number) => {
    return database.savePlaybackCheckpoint(movieId, positionSeconds);
  });

  ipcMain.handle("player:clearPlaybackCheckpoint", (_event, movieId: string) => {
    database.clearPlaybackCheckpoint(movieId);
  });

  ipcMain.handle("player:getFileUrl", (_event, filePath: string): string => {
    // Convert Windows backslashes and return file:// URL for the renderer
    const normalized = filePath.replace(/\\/g, "/");
    return `file:///${normalized}`;
  });

  ipcMain.handle("subtitle:generateForMovie", async (_event, movieId: string, options: SubtitleGenerationOptions): Promise<SubtitleGenerationResult> => {
    const movie = database.getMovie(movieId);
    if (!movie) {
      return {
        ok: false,
        message: "Movie not found.",
        subtitlePath: null,
        detectedLanguage: null,
        outputLanguage: null,
        setupRequired: false
      };
    }

    return runSubtitleGeneration(movie, options);
  });
}

app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");
app.commandLine.appendSwitch("disable-http-cache");

const userDataOverride = process.env.MLA_USER_DATA_DIR?.trim();
if (userDataOverride) {
  app.setPath("userData", path.resolve(userDataOverride));
}

app.whenReady().then(() => {

  const databasePath = path.join(app.getPath("userData"), "mla-plus.db");
  database = new DatabaseClient(databasePath);
  registerHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  database?.close();
  if (registeredGentleShortcut) {
    globalShortcut.unregister(registeredGentleShortcut);
    registeredGentleShortcut = null;
  }
});
