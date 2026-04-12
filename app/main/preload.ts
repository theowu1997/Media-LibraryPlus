import { contextBridge, ipcRenderer } from "electron";
import type {
  AppShellState,
  DuplicateGroup,
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
} from "../shared/contracts";

const api = {
  getAppState: (): Promise<AppShellState> => ipcRenderer.invoke("app:getState"),
  saveMetadataSettings: (settings: MetadataSettings): Promise<AppShellState> =>
    ipcRenderer.invoke("settings:saveMetadata", settings),
  saveOrganizationSettings: (settings: OrganizationSettings): Promise<AppShellState> =>
    ipcRenderer.invoke("settings:saveOrganization", settings),
  pickLibraryFolder: (): Promise<string | null> =>
    ipcRenderer.invoke("settings:pickLibraryFolder"),
  openFile: (filePath: string): Promise<void> =>
    ipcRenderer.invoke("shell:openFile", filePath),
  showInFolder: (filePath: string): Promise<void> =>
    ipcRenderer.invoke("shell:showInFolder", filePath),
  pickScanFolder: (options: ScanAutomationOptions): Promise<ScanSummary> =>
    ipcRenderer.invoke("movies:pickScan", options),
  listMovies: (query?: string, limit?: number, offset?: number): Promise<MovieRecord[]> =>
    ipcRenderer.invoke("movies:list", { query, limit, offset }),
  countMovies: (query?: string): Promise<number> =>
    ipcRenderer.invoke("movies:count", { query }),
  ensureMoviePosters: (movieIds: string[]): Promise<PosterBackfillSummary> =>
    ipcRenderer.invoke("movies:ensurePosters", movieIds),
  refreshMoviePosters: (movieIds: string[]): Promise<PosterBackfillSummary> =>
    ipcRenderer.invoke("movies:refreshPosters", movieIds),
  backfillMissingPosters: (): Promise<PosterBackfillSummary> =>
    ipcRenderer.invoke("movies:backfillPosters"),
  scanLibraries: (options?: ScanAutomationOptions): Promise<ScanSummary> =>
    ipcRenderer.invoke("movies:scan", options),
  cancelScan: (): Promise<void> =>
    ipcRenderer.invoke("scan:cancel"),
  addLibraryRoot: (mode: LibraryMode): Promise<AppShellState> =>
    ipcRenderer.invoke("library:addRoot", mode),
  moveMovie: (movieId: string, mode: LibraryMode): Promise<MovieRecord> =>
    ipcRenderer.invoke("movies:moveMode", movieId, mode),
  moveMovies: (movieIds: string[], mode: LibraryMode): Promise<MovieRecord[]> =>
    ipcRenderer.invoke("movies:batchMoveMode", movieIds, mode),
  unlockGentle: (pin: string): Promise<{ ok: boolean; message: string }> =>
    ipcRenderer.invoke("auth:unlockGentle", pin),
  toggleGentle: (): Promise<AppShellState> =>
    ipcRenderer.invoke("auth:toggleGentle"),
  getActressPhotos: (): Promise<Record<string, string>> =>
    ipcRenderer.invoke("actress:getPhotos"),
  refreshActressPhotos: (): Promise<Record<string, string>> =>
    ipcRenderer.invoke("actress:refreshPhotos"),
  listAllMovies: (): Promise<MovieRecord[]> =>
    ipcRenderer.invoke("movies:listAll"),
  playerFetchSubtitles: (dvdId: string): Promise<OnlineSubtitleResult[]> =>
    ipcRenderer.invoke("player:fetchSubtitles", dvdId),
  playerDownloadSubtitle: (url: string): Promise<string | null> =>
    ipcRenderer.invoke("player:downloadSubtitle", url),
  playerGetSettings: (): Promise<PlayerSettings> =>
    ipcRenderer.invoke("player:getSettings"),
  playerSaveSettings: (settings: PlayerSettings): Promise<PlayerSettings> =>
    ipcRenderer.invoke("player:saveSettings", settings),
  playerGetFileUrl: (filePath: string, folderPath?: string | null): Promise<string> =>
    ipcRenderer.invoke("player:getFileUrl", filePath, folderPath ?? null),
  playerConvertToMp4: (filePath: string): Promise<string | null> =>
    ipcRenderer.invoke("player:convertToMp4", filePath),
  onScanProgress: (handler: (progress: ScanProgress) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: ScanProgress) => {
      handler(progress);
    };
    ipcRenderer.on("scan:progress", listener);
    return () => {
      ipcRenderer.removeListener("scan:progress", listener);
    };
  },
  resolveDuplicate: (keepPath: string, deletePaths: string[], gentleUnlocked?: boolean): Promise<{ deleted: number; blocked: number }> =>
    ipcRenderer.invoke("duplicates:resolve", keepPath, deletePaths, gentleUnlocked),
  actressSetPhoto: (name: string): Promise<Record<string, string>> =>
    ipcRenderer.invoke("actress:setPhoto", name),
  addSubtitleDir: (): Promise<AppShellState> =>
    ipcRenderer.invoke("subtitle:addDir"),
  removeSubtitleDir: (dir: string): Promise<AppShellState> =>
    ipcRenderer.invoke("subtitle:removeDir", dir),
  scanSubtitleDirs: (): Promise<SubtitleScanResult> =>
    ipcRenderer.invoke("subtitle:scan"),
  addVideoFiles: (): Promise<{ added: number; skipped: number }> =>
    ipcRenderer.invoke("movies:addFiles"),
  onGentleToggled: (handler: (state: AppShellState) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: AppShellState) => {
      handler(state);
    };
    ipcRenderer.on("gentle:toggled", listener);
    return () => {
      ipcRenderer.removeListener("gentle:toggled", listener);
    };
  },
};

contextBridge.exposeInMainWorld("desktopApi", api);

export type DesktopApi = typeof api;
