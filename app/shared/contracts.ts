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
  seekDuration: number;
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

export interface ConvertVideoResult {
  ok: boolean;
  url?: string;
  error?: string;
}

export interface AppShellState {
  version: string;
  platform: string;
  gentleUnlocked: boolean;
  roots: LibraryRoots;
  subtitleDirs: string[];
  starterPinHint: string;
  metadataSettings: MetadataSettings;
  organizationSettings: OrganizationSettings;
}

export interface ScanRejectedFile {
  path: string;
  reason: string;
  status: "incomplete" | "corrupt" | "invalid";
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
  invalidFiles: ScanRejectedFile[];
  duplicateGroups: DuplicateGroup[];
  scannedRoots: LibraryRoots;
  cancelled: boolean;
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

export interface MetadataSettings {
  tmdbReadAccessToken: string;
  language: string;
  region: string;
  autoFetchWebPosters: boolean;
}

export interface OrganizationSettings {
  normalPathTemplate: string;
  gentlePathTemplate: string;
  fileNameTemplate: string;
  normalLibraryPath: string;
  gentleLibraryPath: string;
}

export interface ScanAutomationOptions {
  importOnlyCompleteVideos: boolean;
  importBetterQuality: boolean;
  autoResolveDuplicates: boolean;
  moveRename: boolean;
  copyToLibrary: boolean;
  scanAllSubfolders: boolean;
  resolveLongPath: boolean;
  autoConvertToMp4: boolean;
  autoMatchSubtitle: boolean;
  addToNormalModeLibrary: boolean;
  addToGentleModeLibrary: boolean;
}

export const VIDEO_EXTENSIONS = [
  ".mp4",
  ".mkv",
  ".avi",
  ".mov",
  ".wmv",
  ".m4v",
  ".webm"
];

export const SUBTITLE_EXTENSIONS = [".srt", ".vtt", ".ass", ".ssa"];
