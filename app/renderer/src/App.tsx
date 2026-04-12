import React, {
  useEffect,
  useRef,
  useState
} from "react";
import type {
  AppPage,
  AppShellState,
  LibraryMode,
  MovieRecord,
} from "../../shared/contracts";
import { AppSidebar } from "./components/AppSidebar";
import { AppTopBar } from "./components/AppTopBar";
import { ActressesPage } from "./components/ActressesPage";
import { ContextMenu } from "./components/ContextMenu";
import { HomePage } from "./components/HomePage";
import { LibraryPage } from "./components/LibraryPage";
import { SearchPage } from "./components/SearchPage";
import { DuplicateResolutionModal } from "./components/DuplicateResolutionModal";
import { PinPromptDialog } from "./components/PinPromptDialog";
import { PlayerPage } from "./components/PlayerPage";
import { ScanOptionsDialog } from "./components/ScanOptionsDialog";
import { ScanToast } from "./components/ScanToast";
import { SettingsPage } from "./components/SettingsPage";
import { usePlayer } from "./hooks/usePlayer";
import { useSettings } from "./hooks/useSettings";
import { useScanProgress } from "./hooks/useScanProgress";
import { useLibrary } from "./hooks/useLibrary";
import { useSelection } from "./hooks/useSelection";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useScanHandlers } from "./hooks/useScanHandlers";
import { useLibraryActions } from "./hooks/useLibraryActions";
import { useMediaActions } from "./hooks/useMediaActions";
import { useBootstrap } from "./hooks/useBootstrap";
import { useSidebarResize } from "./hooks/useSidebarResize";
import { useDuplicateResolution } from "./hooks/useDuplicateResolution";
import {
  buildOrganizationPreview,
  getRejectedStatusLabel,
} from "./utils";

const pages: { id: AppPage; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "library", label: "Library" },
  { id: "search", label: "Search" },
  { id: "actresses", label: "Actresses" },
  { id: "player", label: "▶ Player" },
  { id: "settings", label: "Settings" }
];

const PAGE_SIZE = 200;




export function App() {
  const desktopApi = window.desktopApi;
  const [appState, setAppState] = useState<AppShellState | null>(null);
  const [activePage, setActivePage] = useState<AppPage>("home");
  const [statusMessage, setStatusMessage] = useState("Preparing local library...");
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [showScanOptionsPrompt, setShowScanOptionsPrompt] = useState(false);
  const [pendingScanMode, setPendingScanMode] = useState<LibraryMode>("normal");
  const [pinInput, setPinInput] = useState("");
  const [contextMenu, setContextMenu] = useState<{
    movie: MovieRecord;
    x: number;
    y: number;
  } | null>(null);
  const [isRefreshingActressPhotos, setIsRefreshingActressPhotos] = useState(false);

  // ── Custom hooks ──────────────────────────────────────────────────────────
  const settings = useSettings({
    desktopApi,
    onStateChange: (state) => {
      setAppState(state);
    },
    onStatus: setStatusMessage,
  });
  const {
    metadataDraft, setMetadataDraft,
    organizationDraft, setOrganizationDraft,
    focusedOrganizationField, setFocusedOrganizationField,
    scanOptionsDraft, setScanOptionsDraft,
    initFromAppState,
    handleSaveMetadataSettings,
    handleSaveOrganizationSettings,
    insertOrganizationToken,
    applyOrganizationPreset,
  } = settings;

  // Stub ref so useScanProgress can call refreshMovies before useLibrary is wired
  const refreshMoviesRef = useRef<() => void>(() => {});

  const {
    scanProgress, setScanProgress,
    lastScanSummary, setLastScanSummary,
    duplicateGroups, setDuplicateGroups,
    duplicateSelections, setDuplicateSelections,
    recentProcessedFiles,
    subtitleScanRunning, setSubtitleScanRunning,
    subtitleScanResult, setSubtitleScanResult,
    isScanning, progressPercent, scanStageLabel,
  } = useScanProgress({
    desktopApi,
    onScanRefresh: () => refreshMoviesRef.current(),
  });

  const {
    movies, setMovies,
    movieTotalCount, setMovieTotalCount, movieLoadOffset, setMovieLoadOffset,
    sortMode, setSortMode,
    selectedMovieId, setSelectedMovieId,
    searchInput, setSearchInput,
    allMoviesPool, setAllMoviesPool,
    actressPhotos, setActressPhotos,
    selectedActress, setSelectedActress,
    actressModeFilter, setActressModeFilter,
    actressGridCols, changeActressGridCols,
    gridColumns, changeGridColumns,
    sortedMovies, actressDirectory, deferredSearch,
    moviesRef,
    refreshMovies, loadMoreMovies, refreshPostersOnly,
  } = useLibrary({
    desktopApi,
    gentleUnlocked: appState?.gentleUnlocked,
    isScanning,
    setActivePage,
  });

  // Wire scan refresh to the live refreshMovies from useLibrary
  refreshMoviesRef.current = () => void refreshMovies();

  const player = usePlayer({ desktopApi, movies, allMoviesPool });
  const {
    videoRef,
    playerContainerRef,
    playerConfigRef,
    playerMovieIdRef,
    playerMovieId, setPlayerMovieId,
    playerFileUrl, setPlayerFileUrl,
    playerPlaying, setPlayerPlaying,
    playerVolume, setPlayerVolume,
    playerMuted, setPlayerMuted,
    playerCurrentTime, setPlayerCurrentTime,
    playerDuration, setPlayerDuration,
    playerPlaybackError, setPlayerPlaybackError,
    playerSubtitles, setPlayerSubtitles,
    playerSubTrackUrl, setPlayerSubTrackUrl,
    playerSubTrackLang, setPlayerSubTrackLang,
    playerSubLoading,
    playerSubSearching, setPlayerSubSearching,
    playerShowSubPanel, setPlayerShowSubPanel,
    playerSubLangFilter, setPlayerSubLangFilter,
    playerSubTargetLang, setPlayerSubTargetLang,
    playerSubDownloadingId,
    playerSubHasSearched, setPlayerSubHasSearched,
    playerSettings, setPlayerSettings,
    playerShowMovieList, setPlayerShowMovieList,
    playerHoveredMovieId, setPlayerHoveredMovieId,
    playerRate, setPlayerRate,
    playerShowConfig, setPlayerShowConfig,
    playerIsFullscreen,
    loadMovieIntoPlayer,
    applySubtitle,
    handleDownloadSubtitle,
    handleSearchSubtitles,
    navigatePlaylist,
    convertMovieToMp4,
  } = player;

  const activePageRef = useRef(activePage);
  activePageRef.current = activePage;

  const {
    selectedIds, setSelectedIds, selectionBox, gridRef,
    handleGridMouseDown, handleTileClick, toggleSelected,
  } = useSelection({ moviesRef, activePageRef });

  const selectedMovie = movies.find((movie) => movie.id === selectedMovieId) ?? null;
  const selectedIdSet = new Set(selectedIds);
  const organizationPreview = buildOrganizationPreview(
    organizationDraft,
    selectedMovie
  );

  const {
    sidebarCollapsed, setSidebarCollapsed,
    sidebarWidth,
    handleSidebarDragStart,
  } = useSidebarResize();

  // ── Handler hooks ─────────────────────────────────────────────────────────
  const {
    handleScanSaved,
    openScanOptions,
    handleConfirmScanOptions,
  } = useScanHandlers({
    desktopApi,
    appState,
    isScanning,
    scanOptionsDraft,
    setScanOptionsDraft,
    deferredSearch,
    refreshMovies,
    initFromAppState,
    setAppState,
    setStatusMessage,
    setLastScanSummary,
    setDuplicateGroups,
    setDuplicateSelections,
    setShowScanOptionsPrompt,
    setPendingScanMode,
  });

  const {
    handleMoveOne,
    handleBatchMove,
    handleUnlock,
    selectMissingPosterTitles,
    handlePickLibraryFolder,
  } = useLibraryActions({
    desktopApi,
    movies,
    selectedIds,
    setSelectedIds,
    pinInput,
    setShowPinPrompt,
    setPinInput,
    deferredSearch,
    refreshMovies,
    initFromAppState,
    setAppState,
    setStatusMessage,
  });

  const {
    handleBackfillPosters,
    handleRefreshActressPhotos,
    handleRefreshSelectedPosters,
    handleAddSubtitleDir,
    handleRemoveSubtitleDir,
    handleRunSubtitleScan,
    handleSavePlayerSettings,
  } = useMediaActions({
    desktopApi,
    selectedIds,
    deferredSearch,
    playerSettings,
    refreshMovies,
    refreshPostersOnly,
    setActressPhotos,
    setAllMoviesPool,
    setStatusMessage,
    setSubtitleScanRunning,
    setSubtitleScanResult,
    setAppState,
    setIsRefreshingActressPhotos,
  });

  useBootstrap({
    desktopApi,
    initFromAppState,
    setAppState,
    setMovies,
    setMovieTotalCount,
    setMovieLoadOffset,
    setSelectedMovieId,
    setAllMoviesPool,
    setActressPhotos,
    setPlayerSettings: player.setPlayerSettings,
    setPlayerVolume: player.setPlayerVolume,
    setStatusMessage,
  });

  const {
    resolveGroup: handleResolveGroup,
    resolveAll: handleResolveAll,
    skipAll: handleSkipAllDuplicates,
  } = useDuplicateResolution({
    desktopApi,
    appState,
    duplicateGroups,
    duplicateSelections,
    setDuplicateGroups,
    setStatusMessage,
  });

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useKeyboardShortcuts({
    onToggleGentle: async () => {
      if (!desktopApi) return;
      const nextState = await desktopApi.toggleGentle();
      setAppState(nextState);
      settings.initFromAppState(nextState);
      await refreshMovies(deferredSearch);
      if (!nextState.gentleUnlocked && actressModeFilter === "gentle") {
        setActressModeFilter("all");
      }
      setStatusMessage(
        nextState.gentleUnlocked
          ? "Gentle mode enabled."
          : "Gentle mode disabled."
      );
    },
  });

  // ── Listen for globalShortcut gentle toggle from main process ───────────
  useEffect(() => {
    if (!desktopApi) return;
    const cleanup = desktopApi.onGentleToggled(async (nextState) => {
      setAppState(nextState);
      settings.initFromAppState(nextState);
      await refreshMovies(deferredSearch);
      if (!nextState.gentleUnlocked && actressModeFilter === "gentle") {
        setActressModeFilter("all");
      }
      setStatusMessage(
        nextState.gentleUnlocked
          ? "Gentle mode enabled."
          : "Gentle mode disabled."
      );
    });
    return cleanup;
  }, [desktopApi]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!desktopApi) {
    return (
      <div className="loading-shell">
        MLA+ is waiting for the Electron desktop bridge. Restart the app window if this screen stays here.
      </div>
    );
  }

  if (!appState) {
    return <div className="loading-shell">Booting MLA+ desktop shell...</div>;
  }

  return (
    <div className="app-shell">
      <AppSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        width={sidebarWidth}
        onResizeStart={handleSidebarDragStart}
        pages={pages}
        activePage={activePage}
        onNavigate={(page) => {
          setActivePage(page);
          if (page !== "actresses") setSelectedActress(null);
        }}
        movies={movies}
        onShowPinPrompt={() => setShowPinPrompt(true)}
        statusMessage={statusMessage}
      />

      <main className="content">
        <AppTopBar
          searchInput={searchInput}
          onSearchChange={setSearchInput}
          isScanning={isScanning}
          onOpenScanOptions={openScanOptions}
          onScanSaved={() => void handleScanSaved()}
          onAddVideoFiles={async () => {
            if (!desktopApi) return;
            const result = await desktopApi.addVideoFiles();
            if (result.added > 0) {
              await refreshMovies(deferredSearch);
              setStatusMessage(`Added ${result.added} video file${result.added !== 1 ? "s" : ""} to library.`);
            } else if (result.skipped > 0) {
              setStatusMessage(`No new files added — ${result.skipped} file${result.skipped !== 1 ? "s were" : " was"} already in the library.`);
            }
          }}
          onCancelScan={() => void desktopApi?.cancelScan()}
          scanProgress={scanProgress}
          scanStageLabel={scanStageLabel}
          lastScanSummaryInvalidFiles={lastScanSummary?.invalidFiles ?? []}
          getRejectedStatusLabel={getRejectedStatusLabel}
        />

        {activePage === "home" && (
          <HomePage movies={movies} appState={appState} />
        )}

        {activePage === "library" && (
          <LibraryPage
            movies={movies}
            sortedMovies={sortedMovies}
            movieTotalCount={movieTotalCount}
            sortMode={sortMode}
            setSortMode={setSortMode}
            gridColumns={gridColumns}
            changeGridColumns={changeGridColumns}
            selectedMovieId={selectedMovieId}
            selectedIdSet={selectedIdSet}
            isScanning={isScanning}
            gridRef={gridRef as React.RefObject<HTMLDivElement>}
            handleGridMouseDown={handleGridMouseDown}
            handleTileClick={handleTileClick}
            toggleSelected={toggleSelected}
            setContextMenu={setContextMenu}
            openScanOptions={openScanOptions}
            selectMissingPosterTitles={selectMissingPosterTitles}
            handleRefreshSelectedPosters={handleRefreshSelectedPosters}
            handleBatchMove={handleBatchMove}
            loadMoreMovies={loadMoreMovies}
            PAGE_SIZE={PAGE_SIZE}
          />
        )}

        {activePage === "search" && (
          <SearchPage
            movies={movies}
            setSelectedMovieId={setSelectedMovieId}
            setActivePage={setActivePage}
          />
        )}

        {activePage === "actresses" && (
          <ActressesPage
            actressDirectory={actressDirectory}
            selectedActress={selectedActress}
            setSelectedActress={setSelectedActress}
            actressGridCols={actressGridCols}
            changeActressGridCols={changeActressGridCols}
            actressModeFilter={actressModeFilter}
            setActressModeFilter={setActressModeFilter}
            gentleUnlocked={appState?.gentleUnlocked ?? false}
            isRefreshingActressPhotos={isRefreshingActressPhotos}
            setIsRefreshingActressPhotos={setIsRefreshingActressPhotos}
            actressPhotos={actressPhotos}
            setActressPhotos={setActressPhotos}
            allMoviesPool={allMoviesPool}
            movies={movies}
            selectedMovieId={selectedMovieId}
            setSelectedMovieId={setSelectedMovieId}
            setActivePage={setActivePage}
            setContextMenu={setContextMenu}
            onRefreshActressPhotos={handleRefreshActressPhotos}
          />
        )}

        {activePage === "player" && (
          <PlayerPage
            movies={movies}
            allMoviesPool={allMoviesPool}
            playerMovieId={playerMovieId}
            videoRef={videoRef as React.RefObject<HTMLVideoElement>}
            playerContainerRef={playerContainerRef as React.RefObject<HTMLElement>}
            playerConfigRef={playerConfigRef as React.RefObject<HTMLElement>}
            playerFileUrl={playerFileUrl}
            playerPlaying={playerPlaying}
            playerMuted={playerMuted}
            playerVolume={playerVolume}
            playerRate={playerRate}
            playerCurrentTime={playerCurrentTime}
            playerDuration={playerDuration}
            playerPlaybackError={playerPlaybackError}
            playerIsFullscreen={playerIsFullscreen}
            playerSettings={playerSettings}
            playerShowConfig={playerShowConfig}
            playerShowMovieList={playerShowMovieList}
            playerHoveredMovieId={playerHoveredMovieId}
            playerShowSubPanel={playerShowSubPanel}
            playerSubTrackUrl={playerSubTrackUrl}
            playerSubTrackLang={playerSubTrackLang}
            playerSubTargetLang={playerSubTargetLang}
            playerSubtitles={playerSubtitles}
            playerSubSearching={playerSubSearching}
            playerSubHasSearched={playerSubHasSearched}
            playerSubDownloadingId={playerSubDownloadingId}
            setPlayerPlaying={setPlayerPlaying}
            setPlayerMuted={setPlayerMuted}
            setPlayerVolume={setPlayerVolume}
            setPlayerRate={setPlayerRate}
            setPlayerCurrentTime={setPlayerCurrentTime}
            setPlayerDuration={setPlayerDuration}
            setPlayerPlaybackError={setPlayerPlaybackError}
            setPlayerSettings={setPlayerSettings}
            setPlayerShowConfig={setPlayerShowConfig}
            setPlayerShowMovieList={setPlayerShowMovieList}
            setPlayerHoveredMovieId={setPlayerHoveredMovieId}
            setPlayerShowSubPanel={setPlayerShowSubPanel}
            setPlayerSubTrackUrl={setPlayerSubTrackUrl}
            setPlayerSubTargetLang={setPlayerSubTargetLang}
            setPlayerSubtitles={setPlayerSubtitles}
            setPlayerSubHasSearched={setPlayerSubHasSearched}
            loadMovieIntoPlayer={loadMovieIntoPlayer}
            navigatePlaylist={navigatePlaylist}
            applySubtitle={applySubtitle}
            handleSearchSubtitles={handleSearchSubtitles}
            handleDownloadSubtitle={handleDownloadSubtitle}
            convertMovieToMp4={convertMovieToMp4}
            playerSaveSettings={async (s) => { await desktopApi?.playerSaveSettings(s); }}
            playerDownloadSubtitleFile={async (url) => desktopApi?.playerDownloadSubtitle(url) ?? null}
            playerOpenFile={async (filePath) => { await desktopApi?.openFile(filePath); }}
            playerShowInFolder={async (filePath) => { await desktopApi?.showInFolder(filePath); }}
          />
        )}

        {activePage === "settings" && (
          <SettingsPage
            appState={appState}
            metadataDraft={metadataDraft}
            setMetadataDraft={setMetadataDraft}
            onSaveMetadataSettings={handleSaveMetadataSettings}
            onBackfillPosters={handleBackfillPosters}
            organizationDraft={organizationDraft}
            setOrganizationDraft={setOrganizationDraft}
            organizationPreview={organizationPreview}
            onSaveOrganizationSettings={handleSaveOrganizationSettings}
            applyOrganizationPreset={applyOrganizationPreset}
            insertOrganizationToken={insertOrganizationToken}
            setFocusedOrganizationField={setFocusedOrganizationField}
            playerSettings={playerSettings}
            setPlayerSettings={setPlayerSettings}
            setPlayerVolume={setPlayerVolume}
            onSavePlayerSettings={handleSavePlayerSettings}
            subtitleScanRunning={subtitleScanRunning}
            subtitleScanResult={subtitleScanResult}
            onAddSubtitleDir={handleAddSubtitleDir}
            onRemoveSubtitleDir={handleRemoveSubtitleDir}
            onRunSubtitleScan={handleRunSubtitleScan}
            onPickLibraryFolder={handlePickLibraryFolder}
          />
        )}
      </main>

      {showScanOptionsPrompt && (
        <ScanOptionsDialog
          pendingScanMode={pendingScanMode}
          organizationDraft={organizationDraft}
          scanOptionsDraft={scanOptionsDraft}
          onChangeScanOption={(key, value) => {
            setScanOptionsDraft((current) => {
              const next = { ...current, [key]: value };
              // mutual exclusion for library mode
              if (key === "addToNormalModeLibrary" && value === true) next.addToGentleModeLibrary = false;
              if (key === "addToGentleModeLibrary" && value === true) next.addToNormalModeLibrary = false;
              return next;
            });
          }}
          onConfirm={() => void handleConfirmScanOptions()}
          onClose={() => setShowScanOptionsPrompt(false)}
        />
      )}

      {showPinPrompt && (
        <PinPromptDialog
          pinInput={pinInput}
          onPinChange={setPinInput}
          onUnlock={() => void handleUnlock()}
          onClose={() => setShowPinPrompt(false)}
        />
      )}

      {selectionBox && (
        <div
          className="selection-box"
          style={{
            height: selectionBox.height,
            left: selectionBox.left,
            top: selectionBox.top,
            width: selectionBox.width
          }}
        />
      )}

      {contextMenu && (
        <ContextMenu
          contextMenu={contextMenu}
          isSelected={selectedIdSet.has(contextMenu.movie.id)}
          onClose={() => setContextMenu(null)}
          onOpenInPlayer={() => {
            void loadMovieIntoPlayer(contextMenu.movie);
            setActivePage("player");
            setContextMenu(null);
          }}
          onOpenExternal={() => { void desktopApi?.openFile(contextMenu.movie.sourcePath); setContextMenu(null); }}
          onShowInFolder={() => { void desktopApi?.showInFolder(contextMenu.movie.sourcePath); setContextMenu(null); }}
          onRefreshPoster={() => { void handleRefreshSelectedPosters([contextMenu.movie.id]); setContextMenu(null); }}
          onMove={() => {
            const target = contextMenu.movie.libraryMode === "normal" ? "gentle" : "normal";
            void handleMoveOne(contextMenu.movie.id, target);
            setContextMenu(null);
          }}
          onToggleSelect={() => { toggleSelected(contextMenu.movie.id); setContextMenu(null); }}
          onCopyPath={() => { void navigator.clipboard.writeText(contextMenu.movie.sourcePath); setContextMenu(null); }}
          onCopyVideoId={contextMenu.movie.videoId ? () => { void navigator.clipboard.writeText(contextMenu.movie.videoId!); setContextMenu(null); } : undefined}
        />
      )}

      {/* Floating scan progress bar — bottom-left corner */}
      {scanProgress && (
        <ScanToast
          scanProgress={scanProgress}
          isScanning={isScanning}
          progressPercent={progressPercent}
          scanStageLabel={scanStageLabel}
          onCancel={() => void desktopApi?.cancelScan()}
          onDismiss={() => setScanProgress(null)}
        />
      )}

      {/* Duplicate resolution modal */}
      {duplicateGroups.length > 0 && !isScanning && (
        <DuplicateResolutionModal
          duplicateGroups={duplicateGroups}
          duplicateSelections={duplicateSelections}
          onSelectFile={(groupKey, filePath) =>
            setDuplicateSelections((s) => ({ ...s, [groupKey]: filePath }))
          }
          onResolveGroup={(groupKey) => void handleResolveGroup(groupKey)}
          onResolveAll={() => void handleResolveAll()}
          onSkipAll={handleSkipAllDuplicates}
        />
      )}
    </div>
  );
}
