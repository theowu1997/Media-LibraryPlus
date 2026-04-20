export type LibraryMode = "normal" | "gentle";
export type ScanMode = LibraryMode | "all";

export type AppPage =
  | "home"
  | "library"
  | "search"
  | "actresses"
  | "player"
  | "settings";

export interface SubtitleRecord {
  id: string;
  language: string;
  path: string;
}

export type SubtitleGenerationLanguage =
  | "auto"
  | "translate-en"
  | "translate-zh"
  | "translate-km";
export type SubtitleGenerationModel = "small" | "medium" | "large-v3";
export type SubtitleGenerationOutputMode =
  | "library-default"
  | "output-srt"
  | "custom-name";

export interface SubtitleGenerationOptions {
  language: SubtitleGenerationLanguage;
  model: SubtitleGenerationModel;
  outputMode: SubtitleGenerationOutputMode;
  customFileName?: string;
}

export interface SubtitleGenerationResult {
  ok: boolean;
  message: string;
  subtitlePath: string | null;
  detectedLanguage: string | null;
  outputLanguage: string | null;
  setupRequired: boolean;
}

export interface OnlineSubtitleResult {
  id: string;
  title: string;
  language: string;
  languageCode: string;
  downloadUrl: string;
  downloads: number;
}

export interface PlayerSettings {
  defaultVolume: number;
  subtitleFontSize: number;
  subtitleColor: string;
  autoPlayNext: boolean;
  rememberPosition: boolean;
  videoFilterPreset: "none" | "vivid" | "warm" | "cool" | "mono" | "sepia";
  videoFilterStrength: number;
}

export interface PlaybackCheckpoint {
  movieId: string;
  positionSeconds: number;
  updatedAt: string;
}

export interface MovieRecord {
  id: string;
  title: string;
  year: number | null;
  videoId: string | null;
  sourcePath: string;
  folderPath: string;
  libraryMode: LibraryMode;
  resolution: string;
  posterUrl: string | null;
  posterSource: "none" | "local" | "web";
  actresses: string[];
  keywords: string[];
  subtitles: SubtitleRecord[];
  updatedAt: string;
}

export interface BuiltinPerformerProfile {
  name: string;
  country?: string;
  photoUrl?: string | null;
}

export interface LibraryRoots {
  normal: string[];
  gentle: string[];
}

export interface SubtitleScanResult {
  total: number;
  matched: number;
  skipped: number;
  unmatched: number;
}

export interface AppShellState {
  version: string;
  platform: string;
  gentleUnlocked: boolean;
  themeMode: "dark" | "light";
  roots: LibraryRoots;
  subtitleDirs: string[];
  starterPinHint: string;
  metadataSettings: MetadataSettings;
  organizationSettings: OrganizationSettings;
  scanHistory: ScanHistoryEntry[];
}

export interface ScanRejectedFile {
  path: string;
  reason: string;
  status: "incomplete" | "corrupt" | "invalid" | "unsupported";
}

export interface DuplicateFile {
  path: string;
  resolution: string;
  fileSize: number;
  autoSelected: boolean;
}

export interface DuplicateGroup {
  key: string;
  videoId: string | null;
  title: string;
  files: DuplicateFile[];
}

export interface PosterBackfillSummary {
  requested: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface ScanSummary {
  discovered: number;
  imported: number;
  skipped: number;
  errors: string[];
  subtitleSearchLogs: string[];
  invalidFiles: ScanRejectedFile[];
  duplicateGroups: DuplicateGroup[];
  scannedRoots: LibraryRoots;
  cancelled: boolean;
}

export interface ScanHistoryEntry {
  createdAt: string;
  summary: ScanSummary;
}

export type ScanStage =
  | "idle"
  | "preparing"
  | "discovering"
  | "processing"
  | "completed"
  | "cancelled"
  | "error";

export interface ScanProgress {
  stage: ScanStage;
  mode: ScanMode;
  currentRoot: string | null;
  currentFile: string | null;
  processedFiles: number;
  totalFiles: number;
  imported: number;
  skipped: number;
  message: string;
}

export type MoveStage =
  | "starting"
  | "moving"
  | "subtitles"
  | "nfo"
  | "database"
  | "cleanup"
  | "rollback"
  | "completed"
  | "error";

export interface MoveProgress {
  stage: MoveStage;
  targetMode: LibraryMode;
  totalMovies: number;
  completedMovies: number;
  currentMovieId: string | null;
  message: string;
  error?: string;
}

export interface MetadataSettings {
  tmdbReadAccessToken: string;
  language: string;
  region: string;
  autoFetchWebPosters: boolean;
  tmdbNonCommercialUse: boolean;
  sourceProfile: MetadataSourceProfile;
}

export type MetadataSourceProfile =
  | "auto"
  | "adult-first"
  | "mainstream-first"
  | "local-only";

export interface OrganizationSettings {
  normalPathTemplate: string;
  gentlePathTemplate: string;
  fileNameTemplate: string;
  normalLibraryPath: string;
  gentleLibraryPath: string;
}

export type SubtitleLanguagePreference =
  | "en"
  | "ja"
  | "zh-hans"
  | "zh-hant"
  | "zh"
  | "ko"
  | "fr"
  | "es"
  | "de"
  | "pt"
  | "th"
  | "vi"
  | "id"
  | "ar"
  | "ru"
  | "it";

export interface ScanAutomationOptions {
  fastScan: boolean;
  importOnlyCompleteVideos: boolean;
  importBetterQuality: boolean;
  autoResolveDuplicates: boolean;
  moveRename: boolean;
  copyToLibrary: boolean;
  scanAllSubfolders: boolean;
  resolveLongPath: boolean;
  autoConvertToMp4: boolean;
  autoMatchSubtitle: boolean;
  autoDownloadSubtitleFromSubtitleCat: boolean;
  preferredSubtitleLanguage: SubtitleLanguagePreference;
  addToNormalModeLibrary: boolean;
  addToGentleModeLibrary: boolean;
}

export const VIDEO_EXTENSIONS = [
  ".3gp",
  ".asf",
  ".flv",
  ".m2ts",
  ".mpeg",
  ".mpg",
  ".mts",
  ".ogv",
  ".mp4",
  ".mkv",
  ".avi",
  ".mov",
  ".ts",
  ".vob",
  ".wmv",
  ".m4v",
  ".webm"
];

export const KNOWN_VIDEO_EXTENSIONS = [
  ...VIDEO_EXTENSIONS,
  ".3gp",
  ".asf",
  ".flv",
  ".m2ts",
  ".mpeg",
  ".mpg",
  ".mts",
  ".ogv",
  ".ts",
  ".vob"
];

export const SUBTITLE_EXTENSIONS = [".srt", ".vtt", ".ass", ".ssa"];
