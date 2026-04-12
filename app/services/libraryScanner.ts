import fs from "node:fs/promises";
import path from "node:path";
import type { DatabaseClient } from "../database/database";
import { probeVideoFile, runFfmpeg } from "./ffmpegService";
import {
  enrichMoviePoster,
  enrichActressPhotos,
  fetchOnlineMovieMetadataByVideoId,
  type OnlineMovieMetadata
} from "./metadataService";
import {
  buildTargetSubtitlePath,
  buildTargetVideoPath,
  ensureLibraryTargetDirectory,
  readNfoMetadata,
  savePosterToFolder,
  writeMovieNfo
} from "./libraryLayout";
import type {
  DuplicateFile,
  DuplicateGroup,
  LibraryMode,
  LibraryRoots,
  OrganizationSettings,
  ScanAutomationOptions,
  ScanMode,
  ScanProgress,
  ScanRejectedFile,
  ScanSummary,
  SubtitleRecord
} from "../shared/contracts";
import {
  SUBTITLE_EXTENSIONS,
  VIDEO_EXTENSIONS
} from "../shared/contracts";
import { extractVideoId } from "../shared/videoId";

interface ParsedMetadata {
  title: string;
  year: number | null;
  videoId: string | null;
  resolution: string;
  keywords: string[];
}

interface ScanCandidate {
  mode: LibraryMode;
  root: string;
  videoFile: string;
  parsed: ParsedMetadata;
  fileSize: number;
}

interface SubtitleCandidate {
  language: string;
  path: string;
}

interface ProcessingResult {
  videoPath: string;
  folderPath: string;
  subtitles: SubtitleCandidate[];
  warnings: string[];
}

type ValidationResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      status: ScanRejectedFile["status"];
      reason: string;
    };

export const DEFAULT_SCAN_OPTIONS: ScanAutomationOptions = {
  importOnlyCompleteVideos: true,
  importBetterQuality: true,
  autoResolveDuplicates: false,
  moveRename: false,
  copyToLibrary: false,
  scanAllSubfolders: true,
  resolveLongPath: true,
  autoConvertToMp4: false,
  autoMatchSubtitle: true,
  addToNormalModeLibrary: true,
  addToGentleModeLibrary: false
};

export interface CancelToken {
  cancelled: boolean;
}

export function createCancelToken(): CancelToken {
  return { cancelled: false };
}

export async function scanLibraries(
  database: DatabaseClient,
  rootsToScan: LibraryRoots = database.getRoots(),
  options?: {
    mode?: ScanMode;
    onProgress?: (progress: ScanProgress) => void;
    scanOptions?: Partial<ScanAutomationOptions>;
    cancelToken?: CancelToken;
  }
): Promise<ScanSummary> {
  const mode = options?.mode ?? "all";
  const onProgress = options?.onProgress;
  const cancelToken = options?.cancelToken;
  const scanOptions = {
    ...DEFAULT_SCAN_OPTIONS,
    ...options?.scanOptions
  };
  const metadataSettings = database.getMetadataSettings();
  const organizationSettings = database.getOrganizationSettings();
  let imported = 0;
  let skipped = 0;
  let processedFiles = 0;
  const errors: string[] = [];
  const invalidFiles: ScanRejectedFile[] = [];
  const candidates: ScanCandidate[] = [];

  onProgress?.({
    stage: "preparing",
    mode,
    currentRoot: null,
    currentFile: null,
    processedFiles: 0,
    totalFiles: 0,
    imported: 0,
    skipped: 0,
    message: "Preparing sequential scan..."
  });

  for (const libraryMode of ["normal", "gentle"] as const) {
    for (const root of rootsToScan[libraryMode]) {
      onProgress?.({
        stage: "discovering",
        mode,
        currentRoot: root,
        currentFile: null,
        processedFiles: 0,
        totalFiles: 0,
        imported,
        skipped,
        message: `Finding media files in ${root}`
      });

      try {
        const videoFiles = await walkForVideos(root, scanOptions.scanAllSubfolders);
        for (const videoFile of videoFiles) {
          const parsed = parseMetadata(
            path.basename(videoFile, path.extname(videoFile))
          );
          candidates.push({
            mode: libraryMode,
            root,
            videoFile,
            parsed,
            fileSize: await getFileSize(videoFile)
          });
        }
      } catch (error) {
        skipped += 1;
        errors.push(`${libraryMode}:${root} - ${formatError(error)}`);
      }
    }
  }

  // Deduplicate candidates by resolved file path (handles overlapping scan roots)
  const seenPaths = new Set<string>();
  const uniqueCandidates: ScanCandidate[] = [];
  for (const c of candidates) {
    const normalized = path.resolve(c.videoFile).toLowerCase();
    if (!seenPaths.has(normalized)) {
      seenPaths.add(normalized);
      uniqueCandidates.push(c);
    }
  }
  candidates.length = 0;
  candidates.push(...uniqueCandidates);

  const totalFiles = candidates.length;
  if (totalFiles === 0) {
    onProgress?.({
      stage: "completed",
      mode,
      currentRoot: null,
      currentFile: null,
      processedFiles: 0,
      totalFiles: 0,
      imported,
      skipped,
      message: "No media files were found in the selected folders."
    });

    return {
      discovered: 0,
      imported,
      skipped,
      errors,
      invalidFiles,
      duplicateGroups: [],
      scannedRoots: rootsToScan,
      cancelled: false
    };
  }

  const processingGroups = buildProcessingGroups(
    candidates,
    scanOptions.importBetterQuality
  );

  // Collect groups that have more than one file (duplicates) for user review
  const duplicateGroups: DuplicateGroup[] = processingGroups
    .filter((group) => group.length > 1)
    .map((group) => ({
      key: group[0].parsed.videoId
        ? `id:${normalizeForKey(group[0].parsed.videoId)}`
        : `title:${normalizeForKey(group[0].parsed.title)}`,
      videoId: group[0].parsed.videoId,
      title: group[0].parsed.title,
      files: group.map((c, i): DuplicateFile => ({
        path: c.videoFile,
        resolution: c.parsed.resolution,
        fileSize: c.fileSize,
        autoSelected: i === 0
      }))
    }));

  for (const group of processingGroups) {
    if (cancelToken?.cancelled) break;
    let importedFromGroup = false;

    for (const candidate of group) {
      if (cancelToken?.cancelled) break;
      onProgress?.({
        stage: "processing",
        mode,
        currentRoot: candidate.root,
        currentFile: candidate.videoFile,
        processedFiles,
        totalFiles,
        imported,
        skipped,
        message: `Processing ${processedFiles + 1} of ${totalFiles}`
      });

      if (importedFromGroup) {
        skipped += 1;
        errors.push(
          `${candidate.mode}:${candidate.videoFile} - Skipped lower-quality duplicate.`
        );
        processedFiles += 1;
        continue;
      }

      if (scanOptions.importOnlyCompleteVideos) {
        const validation = await validateCandidateBeforeImport(candidate.videoFile);
        if (!validation.ok) {
          skipped += 1;
          invalidFiles.push({
            path: candidate.videoFile,
            reason: validation.reason,
            status: validation.status
          });
          errors.push(
            `${candidate.mode}:${candidate.videoFile} - ${validation.reason}`
          );
          processedFiles += 1;
          continue;
        }
      }

      try {
        const onlineMetadata = await resolveOnlineImportMetadata(
          candidate.mode,
          candidate.parsed.videoId
        );
        // Read .nfo sidecar for metadata (actresses, title, etc.)
        const nfoData = await readNfoMetadata(candidate.videoFile);

        // Merge actress info: online > nfo > empty
        const actresses = onlineMetadata?.actresses?.length
          ? onlineMetadata.actresses
          : nfoData.actresses?.length
            ? nfoData.actresses
            : [];

        // Fetch actress profile photos in background (best-effort)
        if (actresses.length > 0) {
          void enrichActressPhotos(database, actresses);
        }
        const subtitles = scanOptions.autoMatchSubtitle
          ? await findMatchingSubtitleCandidates(candidate.videoFile)
          : [];

        const processed = await applyProcessingOptions({
          libraryMode: candidate.mode,
          root: candidate.root,
          videoPath: candidate.videoFile,
          title: candidate.parsed.title,
          year: candidate.parsed.year ?? nfoData.year ?? null,
          videoId: candidate.parsed.videoId ?? nfoData.videoId ?? null,
          actresses,
          modelName: onlineMetadata?.modelName ?? nfoData.studio ?? null,
          subtitles,
          organizationSettings,
          scanOptions
        });

        for (const warning of processed.warnings) {
          errors.push(`${candidate.mode}:${processed.videoPath} - ${warning}`);
        }

        const existingId = database.findMovieIdBySourcePath(processed.videoPath);
        const movieId = existingId ?? database.createMovieId(processed.videoPath);
        const subtitleRecords: SubtitleRecord[] = processed.subtitles.map((subtitle) => ({
          id: database.createSubtitleId(movieId, subtitle.path),
          language: subtitle.language,
          path: subtitle.path
        }));

        database.upsertMovie({
          id: movieId,
          title: candidate.parsed.title,
          year: candidate.parsed.year,
          videoId: candidate.parsed.videoId,
          sourcePath: processed.videoPath,
          folderPath: processed.folderPath,
          libraryMode: candidate.mode,
          resolution: candidate.parsed.resolution,
          posterUrl: onlineMetadata?.posterUrl ?? null,
          posterSource: onlineMetadata?.posterUrl ? "web" : "none",
          actresses,
          keywords: candidate.parsed.keywords
        });
        database.replaceSubtitles(movieId, subtitleRecords);
        imported += 1;
        importedFromGroup = scanOptions.importBetterQuality;

        try {
          await enrichMoviePoster(database, movieId, metadataSettings, {
            onProgress,
            progress: {
              stage: "processing",
              mode,
              currentRoot: candidate.root,
              currentFile: processed.videoPath,
              processedFiles,
              totalFiles,
              imported,
              skipped,
              message: `Fetching web poster for ${candidate.parsed.title}`
            }
          });
        } catch (error) {
          errors.push(`${candidate.mode}:${processed.videoPath} - ${formatError(error)}`);
        }

        // Save poster image file into the movie folder
        try {
          const posterMovie = database.getMovie(movieId);
          if (posterMovie?.posterUrl?.startsWith("http")) {
            await savePosterToFolder(processed.folderPath, posterMovie.posterUrl);
          }
        } catch {
          // Best-effort — ignore poster save failures
        }
      } catch (error) {
        skipped += 1;
        errors.push(`${candidate.mode}:${candidate.videoFile} - ${formatError(error)}`);
      }

      processedFiles += 1;
    }
  }

  const wasCancelled = Boolean(cancelToken?.cancelled);

  onProgress?.({
    stage: wasCancelled ? "cancelled" : "completed",
    mode,
    currentRoot: null,
    currentFile: null,
    processedFiles,
    totalFiles,
    imported,
    skipped,
    message: wasCancelled
      ? `Scan stopped after ${processedFiles} files. Imported ${imported}.`
      : `Processed ${processedFiles} files.`
  });

  return {
    discovered: totalFiles,
    imported,
    skipped,
    errors,
    invalidFiles,
    duplicateGroups,
    scannedRoots: rootsToScan,
    cancelled: wasCancelled
  };
}

async function walkForVideos(root: string, recursive: boolean): Promise<string[]> {
  const entries = await fs.readdir(root, {
    withFileTypes: true
  });
  const videoFiles: string[] = [];

  for (const entry of entries) {
    const resolved = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (recursive) {
        videoFiles.push(...(await walkForVideos(resolved, true)));
      }
      continue;
    }

    if (VIDEO_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())) {
      videoFiles.push(resolved);
    }
  }

  return videoFiles;
}

async function findMatchingSubtitleCandidates(
  videoPath: string
): Promise<SubtitleCandidate[]> {
  const directory = path.dirname(videoPath);
  const basename = path
    .basename(videoPath, path.extname(videoPath))
    .toLowerCase();
  const entries = await fs.readdir(directory, {
    withFileTypes: true
  });

  return entries
    .filter((entry) => entry.isFile())
    .filter((entry) =>
      SUBTITLE_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())
    )
    .filter((entry) => {
      const subBasename = path.basename(entry.name, path.extname(entry.name)).toLowerCase();
      // Match if subtitle name starts with video name (exact/extended subtitles)
      // OR video name starts with subtitle name (short subtitle like "IPX-787.srt" for "IPX-787 Full Title.mp4")
      return subBasename.startsWith(basename) || basename.startsWith(subBasename);
    })
    .map((entry) => ({
      language: extractSubtitleLanguage(entry.name),
      path: path.join(directory, entry.name)
    }));
}

async function applyProcessingOptions(params: {
  libraryMode: LibraryMode;
  root: string;
  videoPath: string;
  title: string;
  year: number | null;
  videoId: string | null;
  actresses: string[];
  modelName: string | null;
  subtitles: SubtitleCandidate[];
  organizationSettings: OrganizationSettings;
  scanOptions: ScanAutomationOptions;
}): Promise<ProcessingResult> {
  const warnings: string[] = [];
  let currentVideoPath = params.videoPath;
  let currentFolderPath = path.dirname(currentVideoPath);
  let currentSubtitles = [...params.subtitles];
  const originalVideoDirectory = path.dirname(params.videoPath);
  const workspaceRoot =
    params.libraryMode === "gentle"
      ? params.organizationSettings.gentleLibraryPath
      : params.organizationSettings.normalLibraryPath;
  const targetRoot = workspaceRoot.trim() || params.root;
  // Always organize: rename + move into structured library folders
  const needsOrganizedPlacement = true;

  if (
    params.scanOptions.autoConvertToMp4 &&
    path.extname(currentVideoPath).toLowerCase() !== ".mp4"
  ) {
    const convertDirectory = needsOrganizedPlacement
      ? await ensureLibraryTargetDirectory(targetRoot, {
          libraryMode: params.libraryMode,
          title: params.title,
          year: params.year,
          videoId: params.videoId,
          actresses: params.actresses,
          modelName: params.modelName,
          resolveLongPath: params.scanOptions.resolveLongPath,
          organizationSettings: params.organizationSettings
        })
      : currentFolderPath;

    const targetMp4Path = await ensureUniquePath(
      buildTargetVideoPath(convertDirectory, {
        libraryMode: params.libraryMode,
        title: params.title,
        year: params.year,
        videoId: params.videoId,
        actresses: params.actresses,
        modelName: params.modelName,
        resolveLongPath: params.scanOptions.resolveLongPath,
        organizationSettings: params.organizationSettings
      }, ".mp4")
    );

    try {
      await convertVideoToMp4(currentVideoPath, targetMp4Path);
      await fs.unlink(currentVideoPath).catch(() => undefined);
      currentVideoPath = targetMp4Path;
      currentFolderPath = path.dirname(currentVideoPath);
    } catch (error) {
      warnings.push(`MP4 conversion failed: ${formatError(error)}`);
    }
  }

  if (needsOrganizedPlacement) {
    try {
      const targetDirectory = await ensureLibraryTargetDirectory(targetRoot, {
        libraryMode: params.libraryMode,
        title: params.title,
        year: params.year,
        videoId: params.videoId,
        actresses: params.actresses,
        modelName: params.modelName,
        resolveLongPath: params.scanOptions.resolveLongPath,
        organizationSettings: params.organizationSettings
      });
      const targetVideoPath = await ensureUniquePath(
        buildTargetVideoPath(targetDirectory, {
          libraryMode: params.libraryMode,
          title: params.title,
          year: params.year,
          videoId: params.videoId,
          actresses: params.actresses,
          modelName: params.modelName,
          resolveLongPath: params.scanOptions.resolveLongPath,
          organizationSettings: params.organizationSettings
        }, path.extname(currentVideoPath))
      );

      if (path.resolve(targetVideoPath) !== path.resolve(currentVideoPath)) {
        await moveFile(currentVideoPath, targetVideoPath);
      }
      currentVideoPath = targetVideoPath;
      currentFolderPath = targetDirectory;
    } catch (error) {
      warnings.push(`Move/Rename failed: ${formatError(error)}`);
    }
  }

  if (currentSubtitles.length > 0 && needsOrganizedPlacement) {
    const movedSubtitles: SubtitleCandidate[] = [];

    for (const subtitle of currentSubtitles) {
      try {
        const extension = path.extname(subtitle.path);
        const targetSubtitlePath = await ensureUniquePath(
          buildTargetSubtitlePath({
            directory: currentFolderPath,
            title: params.title,
            year: params.year,
            videoId: params.videoId,
            actresses: params.actresses,
            modelName: params.modelName,
            language: subtitle.language,
            extension,
            subtitleCount: currentSubtitles.length,
            resolveLongPath: params.scanOptions.resolveLongPath,
            organizationSettings: params.organizationSettings
          })
        );

        if (path.resolve(targetSubtitlePath) !== path.resolve(subtitle.path)) {
          await moveFile(subtitle.path, targetSubtitlePath);
        }

        movedSubtitles.push({
          ...subtitle,
          path: targetSubtitlePath
        });
      } catch (error) {
        warnings.push(`Subtitle move failed: ${formatError(error)}`);
        movedSubtitles.push(subtitle);
      }
    }

    currentSubtitles = movedSubtitles;
  }

  // Write .nfo sidecar for all library modes
  if (needsOrganizedPlacement) {
    try {
      await writeMovieNfo({
        directory: currentFolderPath,
        libraryMode: params.libraryMode,
        title: params.title,
        year: params.year,
        videoId: params.videoId,
        actresses: params.actresses,
        modelName: params.modelName,
        sourcePath: currentVideoPath,
        organizationSettings: params.organizationSettings
      });
    } catch (error) {
      warnings.push(`NFO write failed: ${formatError(error)}`);
    }
  }

  await cleanupDirectory(originalVideoDirectory);
  for (const subtitle of params.subtitles) {
    await cleanupDirectory(path.dirname(subtitle.path));
  }

  return {
    videoPath: currentVideoPath,
    folderPath: currentFolderPath,
    subtitles: currentSubtitles,
    warnings
  };
}

async function convertVideoToMp4(sourcePath: string, targetPath: string): Promise<void> {
  await runFfmpeg([
    "-y",
    "-i",
    sourcePath,
    "-c:v",
    "libx264",
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    targetPath
  ]);
}

function buildProcessingGroups(
  candidates: ScanCandidate[],
  preferBetterQuality: boolean
): ScanCandidate[][] {
  if (!preferBetterQuality) {
    return candidates.map((candidate) => [candidate]);
  }

  const groupedCandidates = new Map<string, ScanCandidate[]>();

  for (const candidate of candidates) {
    const key = candidate.parsed.videoId
      ? `id:${normalizeForKey(candidate.parsed.videoId)}`
      : `${normalizeForKey(candidate.parsed.title)}:${candidate.parsed.year ?? "unknown"}`;
    const current = groupedCandidates.get(key) ?? [];
    current.push(candidate);
    groupedCandidates.set(key, current);
  }

  return Array.from(groupedCandidates.values()).map((group) =>
    [...group].sort((left, right) => compareCandidateQuality(right, left))
  );
}

function compareCandidateQuality(left: ScanCandidate, right: ScanCandidate): number {
  const leftResolution = resolutionScore(left.parsed.resolution);
  const rightResolution = resolutionScore(right.parsed.resolution);
  if (leftResolution !== rightResolution) {
    return leftResolution - rightResolution;
  }

  return left.fileSize - right.fileSize;
}

function resolutionScore(resolution: string): number {
  switch (resolution.toUpperCase()) {
    case "4K":
    case "2160P":
      return 4;
    case "1080P":
      return 3;
    case "720P":
      return 2;
    case "480P":
      return 1;
    default:
      return 0;
  }
}

function normalizeForKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

async function validateCandidateBeforeImport(
  filePath: string
): Promise<ValidationResult> {
  const stableCheck = await ensureFileIsStable(filePath);
  if (!stableCheck.ok) {
    return stableCheck;
  }

  const probeResult = await probeVideoFile(filePath);
  if (!probeResult.valid) {
    return {
      ok: false,
      status: probeResult.status ?? "invalid",
      reason: probeResult.reason ?? "The media probe rejected this file."
    };
  }

  return { ok: true };
}

async function ensureFileIsStable(filePath: string): Promise<ValidationResult> {
  try {
    const firstStats = await fs.stat(filePath);
    if (firstStats.size <= 0) {
      return {
        ok: false,
        status: "invalid",
        reason: "File is empty."
      };
    }

    await delay(1000);

    const secondStats = await fs.stat(filePath);
    if (secondStats.size <= 0) {
      return {
        ok: false,
        status: "invalid",
        reason: "File became empty during validation."
      };
    }

    if (
      firstStats.size !== secondStats.size ||
      Math.trunc(firstStats.mtimeMs) !== Math.trunc(secondStats.mtimeMs)
    ) {
      return {
        ok: false,
        status: "incomplete",
        reason: "File is still changing on disk and looks like an unfinished download."
      };
    }
  } catch (error) {
    return {
      ok: false,
      status: "invalid",
      reason: `File could not be read during validation: ${formatError(error)}`
    };
  }

  return {
    ok: true
  };
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function getFileSize(filePath: string): Promise<number> {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch {
    return 0;
  }
}

function extractSubtitleLanguage(filename: string): string {
  const stem = path.basename(filename, path.extname(filename));
  const segments = stem.split(".");
  const candidate = segments[segments.length - 1];

  if (candidate.length >= 2 && candidate.length <= 5) {
    return candidate.toUpperCase();
  }

  return "UND";
}

function parseMetadata(stem: string): ParsedMetadata {
  const normalized = stem.replace(/[._]+/g, " ").replace(/\s+/g, " ").trim();
  const withoutDuplicateMarkers = normalized
    .replace(/\((?:\d+)\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const videoId = extractVideoId(withoutDuplicateMarkers);
  const yearMatch = normalized.match(/\b(19\d{2}|20\d{2})\b/);
  const resolutionMatch = normalized.match(/\b(2160p|1080p|720p|480p|4k)\b/i);

  let title = withoutDuplicateMarkers
    .replace(/\b(19\d{2}|20\d{2})\b/, "")
    .replace(
      /\b(2160p|1080p|720p|480p|4k|bluray|webrip|x264|x265|aac|h264)\b/gi,
      ""
    )
    .replace(/\b\d{5,8}(?=\s+[A-Z]{2,10}[- ]?\d{2,6}\b)/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (videoId) {
    title = title
      .replace(new RegExp(`\\b${videoId.replace(/-/g, "[- ]?")}\\b`, "i"), " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  const cleanedTitle = title || normalized;
  const keywords = Array.from(
    new Set(
      [videoId, ...cleanedTitle.split(" ")]
        .filter((token): token is string => Boolean(token))
        .map((token) => token.trim())
        .filter((token) => token.length > 2)
    )
  )
    .slice(0, 8);

  return {
    title: title || videoId || cleanedTitle,
    year: yearMatch ? Number(yearMatch[1]) : null,
    videoId,
    resolution: resolutionMatch ? resolutionMatch[1].toUpperCase() : "Unknown",
    keywords
  };
}

async function resolveOnlineImportMetadata(
  _mode: LibraryMode,
  videoId: string | null
): Promise<OnlineMovieMetadata | null> {
  if (!videoId) {
    return null;
  }

  try {
    return await fetchOnlineMovieMetadataByVideoId(videoId);
  } catch {
    return null;
  }
}

/**
 * Register existing local video files into the library without moving or copying them.
 * Files stay exactly where they are on disk — only their path is recorded in the DB.
 */
export async function registerLocalFiles(
  database: DatabaseClient,
  filePaths: string[],
  mode: LibraryMode = "normal"
): Promise<{ added: number; skipped: number }> {
  let added = 0;
  let skipped = 0;

  for (const filePath of filePaths) {
    const ext = path.extname(filePath).toLowerCase();
    if (!VIDEO_EXTENSIONS.includes(ext as (typeof VIDEO_EXTENSIONS)[number])) {
      skipped++;
      continue;
    }

    if (database.findMovieIdBySourcePath(filePath)) {
      skipped++;
      continue;
    }

    const stem = path.basename(filePath, ext);
    const parsed = parseMetadata(stem);

    let resolution = parsed.resolution;
    try {
      const probe = await probeVideoFile(filePath);
      if (probe.valid && probe.height) {
        if (probe.height >= 2160) resolution = "2160P";
        else if (probe.height >= 1080) resolution = "1080P";
        else if (probe.height >= 720) resolution = "720P";
        else if (probe.height >= 480) resolution = "480P";
      }
    } catch { /* use filename-derived resolution if probe unavailable */ }

    database.upsertMovie({
      id: database.createMovieId(filePath),
      title: parsed.title || stem,
      year: parsed.year,
      videoId: parsed.videoId,
      sourcePath: filePath,
      folderPath: path.dirname(filePath),
      libraryMode: mode,
      resolution,
      posterUrl: null,
      posterSource: "none",
      actresses: [],
      keywords: parsed.keywords,
    });
    added++;
  }

  return { added, skipped };
}

async function ensureUniquePath(initialPath: string): Promise<string> {
  const extension = path.extname(initialPath);
  const stem = path.basename(initialPath, extension);
  const directory = path.dirname(initialPath);
  let candidate = initialPath;
  let index = 1;

  while (await exists(candidate)) {
    candidate = path.join(directory, `${stem} (${index})${extension}`);
    index += 1;
  }

  return candidate;
}

/** Robust file move for Windows + cross-device scenarios.
 *  Handles: EXDEV (cross-drive), EPERM/EACCES (read-only attr / ACL),
 *  EBUSY (file locked — retries up to 5× with 300 ms back-off). */
async function moveFile(sourcePath: string, targetPath: string): Promise<void> {
  // Retry loop for locked files (EBUSY / EPERM on Windows)
  const RETRIES = 5;
  const RETRY_DELAY_MS = 300;

  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      await fs.rename(sourcePath, targetPath);
      return; // success
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;

      // Transient lock — wait and retry
      if ((code === "EBUSY" || code === "EPERM") && attempt < RETRIES) {
        await new Promise<void>((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
        continue;
      }

      // Cross-device OR persistent permission error → fall back to copy + delete
      if (code === "EXDEV" || code === "EPERM" || code === "EACCES") {
        await fs.copyFile(sourcePath, targetPath);
        // Strip read-only attribute before deleting (Windows ACL)
        await fs.chmod(sourcePath, 0o666).catch(() => undefined);
        await fs.unlink(sourcePath);
        return;
      }

      throw error;
    }
  }
}

async function cleanupDirectory(directory: string): Promise<void> {
  if (!(await exists(directory))) {
    return;
  }

  const remaining = await fs.readdir(directory);
  const real = remaining.filter((f) => f !== "Thumbs.db" && f !== "desktop.ini" && f !== ".DS_Store");
  if (real.length === 0) {
    await fs.rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function exists(candidate: string): Promise<boolean> {
  try {
    await fs.access(candidate);
    return true;
  } catch {
    return false;
  }
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code;
    const hint =
      code === "EPERM" || code === "EACCES"
        ? " (permission denied — file may be in use or read-only)"
        : code === "ENOENT"
        ? " (source file not found)"
        : code === "ENOSPC"
        ? " (disk full)"
        : code
        ? ` [${code}]`
        : "";
    return `${error.message}${hint}`;
  }
  return "Unknown scanner error";
}
