import { useEffect, useRef, useState, type CSSProperties } from "react";
import type React from "react";
import type { LibraryMode, MovieRecord } from "../../../shared/contracts";
import { MovieTile } from "./MovieTile";

type SortMode =
  | "actress"
  | "import-date"
  | "dvd-id"
  | "studio"
  | "tag"
  | "actress-age"
  | "recent-add"
  | "oldest"
  | "newest";

interface LibraryPageProps {
  movies: MovieRecord[];
  sortedMovies: MovieRecord[];
  movieTotalCount: number;
  sortMode: SortMode;
  setSortMode: (mode: SortMode) => void;
  gridColumns: number;
  changeGridColumns: (cols: number) => void;
  selectedMovieId: string | null;
  selectedIdSet: Set<string>;
  isScanning: boolean;
  gridRef: React.RefObject<HTMLDivElement | null>;
  handleGridMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  handleTileClick: (movie: MovieRecord, event: React.MouseEvent) => void;
  toggleSelected: (movieId: string) => void;
  setContextMenu: (menu: { movie: MovieRecord; x: number; y: number } | null) => void;
  openScanOptions: (mode: LibraryMode) => void;
  selectMissingPosterTitles: () => void;
  handleRefreshSelectedPosters: (movieIds?: string[]) => Promise<void>;
  handleBatchMove: (mode: LibraryMode) => Promise<void>;
  loadMoreMovies: () => Promise<void>;
  PAGE_SIZE: number;
}

export function LibraryPage({
  movies,
  sortedMovies,
  movieTotalCount,
  sortMode,
  setSortMode,
  gridColumns,
  changeGridColumns,
  selectedMovieId,
  selectedIdSet,
  isScanning,
  gridRef,
  handleGridMouseDown,
  handleTileClick,
  toggleSelected,
  setContextMenu,
  openScanOptions,
  selectMissingPosterTitles,
  handleRefreshSelectedPosters,
  handleBatchMove,
  loadMoreMovies,
  PAGE_SIZE,
}: LibraryPageProps) {
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const scanMenuRef = useRef<HTMLDivElement | null>(null);
  const [showScanMenu, setShowScanMenu] = useState(false);

  useEffect(() => {
    if (movies.length >= movieTotalCount) {
      return;
    }
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) {
      return;
    }

    let loading = false;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || loading) {
          return;
        }
        loading = true;
        void loadMoreMovies().finally(() => {
          loading = false;
        });
      },
      {
        root: null,
        rootMargin: "1200px 0px 1200px 0px",
        threshold: 0,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [movies.length, movieTotalCount, loadMoreMovies]);

  useEffect(() => {
    if (!showScanMenu) {
      return;
    }

    function handlePointerDown(event: MouseEvent): void {
      if (scanMenuRef.current && !scanMenuRef.current.contains(event.target as Node)) {
        setShowScanMenu(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showScanMenu]);

  return (
    <section className="page library-page">
      <div className="library-shell">
        <div className="panel library-controls-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Library management</p>
              <h3>
                Batch-safe local file control
                {movieTotalCount > 0 && (
                  <span className="movie-count-badge"> — {movieTotalCount.toLocaleString()} movies</span>
                )}
              </h3>
            </div>
            <div className="inline-actions">
              <div className="columns-control">
                <span>Sort</span>
                <select
                  className="filter-select"
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as SortMode)}
                >
                  <option value="actress">1. Actress A–Z</option>
                  <option value="studio">2. Studio</option>
                  <option value="tag">3. Tag</option>
                  <option value="import-date">4. Import Date</option>
                  <option value="dvd-id">5. DVD ID</option>
                  <option value="actress-age">6. Actress Age</option>
                  <option value="recent-add">7. Recent Add</option>
                  <option value="oldest">8. Oldest</option>
                  <option value="newest">9. Newest</option>
                </select>
              </div>
              <div className="zoom-control">
                <button
                  className="zoom-btn"
                  disabled={gridColumns <= 4}
                  onClick={() => changeGridColumns(gridColumns - 1)}
                  title="Zoom in"
                  type="button"
                >
                  +
                </button>
                <span className="zoom-pct">{Math.round(600 / gridColumns)}%</span>
                <button
                  className="zoom-btn"
                  disabled={gridColumns >= 8}
                  onClick={() => changeGridColumns(gridColumns + 1)}
                  title="Zoom out"
                  type="button"
                >
                  −
                </button>
              </div>
              <div className="scan-popup-anchor" ref={scanMenuRef}>
                <button
                  className="secondary-button"
                  disabled={isScanning}
                  onClick={() => setShowScanMenu((current) => !current)}
                  type="button"
                >
                  Scan library
                </button>
                {showScanMenu && (
                  <div className="scan-mode-popup">
                    <button
                      className="scan-mode-popup-item"
                      onClick={() => {
                        setShowScanMenu(false);
                        openScanOptions("normal");
                      }}
                      type="button"
                    >
                      Scan normal media folder
                    </button>
                    <button
                      className="scan-mode-popup-item"
                      onClick={() => {
                        setShowScanMenu(false);
                        openScanOptions("gentle");
                      }}
                      type="button"
                    >
                      Scan gentle media folder
                    </button>
                  </div>
                )}
              </div>
              <button
                className="ghost-button"
                disabled={isScanning}
                onClick={selectMissingPosterTitles}
                type="button"
              >
                Select missing posters
              </button>
              <button
                className="ghost-button"
                disabled={isScanning || selectedIdSet.size === 0}
                onClick={() => void handleRefreshSelectedPosters()}
                type="button"
              >
                Regenerate selected posters
              </button>
              <button
                className="ghost-button"
                onClick={() => void handleBatchMove("normal")}
                type="button"
              >
                Move selected to normal
              </button>
              <button
                className="ghost-button"
                onClick={() => void handleBatchMove("gentle")}
                type="button"
              >
                Move selected to gentle
              </button>
            </div>
          </div>
        </div>

        <div className="panel library-grid-panel">
          <div
            className="movie-grid"
            onMouseDown={handleGridMouseDown}
            ref={gridRef}
            style={{ "--cols": gridColumns } as CSSProperties}
          >
            {sortedMovies.map((movie) => (
              <MovieTile
                key={movie.id}
                movie={movie}
                isActive={movie.id === selectedMovieId}
                isSelected={selectedIdSet.has(movie.id)}
                showCheckbox
                viewMode="grid"
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ movie, x: e.clientX, y: e.clientY });
                }}
                onClick={(event) => handleTileClick(movie, event)}
                onToggleSelect={() => toggleSelected(movie.id)}
              />
            ))}
          </div>
          {movies.length < movieTotalCount && (
            <div className="load-more-bar">
              <span className="load-more-count">{movies.length} of {movieTotalCount} movies</span>
              <button
                className="ghost-button"
                onClick={() => void loadMoreMovies()}
                type="button"
              >
                Load {Math.min(PAGE_SIZE, movieTotalCount - movies.length)} more
              </button>
            </div>
          )}
          {movies.length < movieTotalCount && <div className="library-scroll-sentinel" ref={loadMoreSentinelRef} />}
        </div>
      </div>
    </section>
  );
}
