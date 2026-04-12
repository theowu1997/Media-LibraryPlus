import type {
  AppShellState,
  MetadataSettings,
  LibraryMode,
  MovieRecord,
  OnlineSubtitleResult,
  OrganizationSettings,
  PlayerSettings,
  PosterBackfillSummary,
  ScanAutomationOptions,
  ScanProgress,
  ScanSummary,
  SubtitleScanResult
} from "../../shared/contracts";

declare global {
  interface Window {
    desktopApi: {
      getAppState: () => Promise<AppShellState>;
      saveMetadataSettings: (settings: MetadataSettings) => Promise<AppShellState>;
      saveOrganizationSettings: (settings: OrganizationSettings) => Promise<AppShellState>;
      pickLibraryFolder: () => Promise<string | null>;
      openFile: (filePath: string) => Promise<void>;
      showInFolder: (filePath: string) => Promise<void>;
      pickScanFolder: (options: ScanAutomationOptions) => Promise<ScanSummary>;
      listMovies: (query?: string, limit?: number, offset?: number) => Promise<MovieRecord[]>;
      countMovies: (query?: string) => Promise<number>;
      listAllMovies: () => Promise<MovieRecord[]>;
      ensureMoviePosters: (movieIds: string[]) => Promise<PosterBackfillSummary>;
      refreshMoviePosters: (movieIds: string[]) => Promise<PosterBackfillSummary>;
      backfillMissingPosters: () => Promise<PosterBackfillSummary>;
      scanLibraries: (options?: ScanAutomationOptions) => Promise<ScanSummary>;
      cancelScan: () => Promise<void>;
      addLibraryRoot: (mode: LibraryMode) => Promise<AppShellState>;
      moveMovie: (movieId: string, mode: LibraryMode) => Promise<MovieRecord>;
      moveMovies: (movieIds: string[], mode: LibraryMode) => Promise<MovieRecord[]>;
      unlockGentle: (pin: string) => Promise<{ ok: boolean; message: string }>;
      toggleGentle: () => Promise<AppShellState>;
      getActressPhotos: () => Promise<Record<string, string>>;
      refreshActressPhotos: () => Promise<Record<string, string>>;
      actressSetPhoto: (name: string) => Promise<Record<string, string>>;
      playerFetchSubtitles: (dvdId: string) => Promise<OnlineSubtitleResult[]>;
      playerDownloadSubtitle: (url: string) => Promise<string | null>;
      playerGetSettings: () => Promise<PlayerSettings>;
      playerSaveSettings: (settings: PlayerSettings) => Promise<PlayerSettings>;
      playerGetFileUrl: (filePath: string, folderPath?: string | null) => Promise<string>;
      playerConvertToMp4: (filePath: string) => Promise<{ ok: boolean; url?: string; error?: string }>;
      onScanProgress: (handler: (progress: ScanProgress) => void) => () => void;
      resolveDuplicate: (keepPath: string, deletePaths: string[], gentleUnlocked?: boolean) => Promise<{ deleted: number; blocked: number }>;
      addSubtitleDir: () => Promise<AppShellState>;
      removeSubtitleDir: (dir: string) => Promise<AppShellState>;
      scanSubtitleDirs: () => Promise<SubtitleScanResult>;
      addVideoFiles: () => Promise<{ added: number; skipped: number }>;
      onGentleToggled: (handler: (state: AppShellState) => void) => () => void;
    };
  }
}

export {};
