import type { Dispatch, SetStateAction } from "react";
import type { AppShellState, LibraryMode, MovieRecord } from "../../../shared/contracts";

interface UseLibraryActionsProps {
  desktopApi: typeof window.desktopApi;
  movies: MovieRecord[];
  selectedIds: string[];
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  pinInput: string;
  setShowPinPrompt: Dispatch<SetStateAction<boolean>>;
  setPinInput: Dispatch<SetStateAction<string>>;
  deferredSearch: string;
  refreshMovies: (query?: string) => Promise<void>;
  initFromAppState: (state: AppShellState) => void;
  setAppState: Dispatch<SetStateAction<AppShellState | null>>;
  setStatusMessage: (msg: string) => void;
}

export function useLibraryActions({
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
}: UseLibraryActionsProps) {
  async function handleMoveOne(movieId: string, mode: LibraryMode): Promise<void> {
    if (!desktopApi) {
      setStatusMessage("Desktop bridge unavailable. Restart MLA+ and try again.");
      return;
    }
    setStatusMessage(`Moving title into ${mode} library...`);
    await desktopApi.moveMovie(movieId, mode);
    await refreshMovies(deferredSearch);
    setStatusMessage(`Movie moved into ${mode} library.`);
  }

  async function handleBatchMove(mode: LibraryMode): Promise<void> {
    if (!desktopApi) {
      setStatusMessage("Desktop bridge unavailable. Restart MLA+ and try again.");
      return;
    }
    if (selectedIds.length === 0) {
      setStatusMessage("Select at least one movie before running a batch move.");
      return;
    }
    const moveCount = selectedIds.length;
    setStatusMessage(`Moving ${moveCount} movies into ${mode} library...`);
    await desktopApi.moveMovies(selectedIds, mode);
    setSelectedIds([]);
    await refreshMovies(deferredSearch);
    setStatusMessage(`Batch move complete for ${moveCount} titles.`);
  }

  async function handleUnlock(): Promise<void> {
    if (!desktopApi) {
      setStatusMessage("Desktop bridge unavailable. Restart MLA+ and try again.");
      return;
    }
    const result = await desktopApi.unlockGentle(pinInput);
    setStatusMessage(result.message);
    if (!result.ok) return;
    const nextState = await desktopApi.getAppState();
    setAppState(nextState);
    initFromAppState(nextState);
    setShowPinPrompt(false);
    setPinInput("");
  }

  function selectMissingPosterTitles(): void {
    const missingIds = movies.filter((movie) => !movie.posterUrl).map((movie) => movie.id);
    setSelectedIds(missingIds);
    setStatusMessage(
      missingIds.length > 0
        ? `${missingIds.length} title${missingIds.length === 1 ? "" : "s"} without posters selected.`
        : "Every visible title already has a poster."
    );
  }

  async function handlePickLibraryFolder(): Promise<string | undefined> {
    if (!desktopApi) return undefined;
    const result = await desktopApi.pickLibraryFolder();
    return result ?? undefined;
  }

  return {
    handleMoveOne,
    handleBatchMove,
    handleUnlock,
    selectMissingPosterTitles,
    handlePickLibraryFolder,
  };
}
