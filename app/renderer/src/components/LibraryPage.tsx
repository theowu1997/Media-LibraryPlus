import { useEffect, useRef, useState, type CSSProperties } from "react";
import type React from "react";
import type { LibraryMode, MovieRecord } from "../../../shared/contracts";
import { MovieTile } from "./MovieTile";

const LIBRARY_TILE_FIELDS_STORAGE_KEY = "mla.library.tileFields.v1";

const DISPLAY_FIELD_OPTIONS = [
  { id: "fullTitle", label: "Full Title" },
  { id: "dvdId", label: "DVDID" },
  { id: "actress", label: "Actress" },
  { id: "tag", label: "Tag" },
  { id: "genre", label: "Genre" },
  { id: "censored", label: "Censored" },
  { id: "uncensored", label: "Uncensored" },
  { id: "studio", label: "Studio" },
  { id: "year", label: "Year" },
] as const;

type LibraryTileDisplayField = (typeof DISPLAY_FIELD_OPTIONS)[number]["id"];

const DEFAULT_TILE_FIELDS: LibraryTileDisplayField[] = ["fullTitle", "dvdId", "actress", "year"];

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
  const fieldsMenuRef = useRef<HTMLDivElement | null>(null);
  const [showFieldsMenu, setShowFieldsMenu] = useState(false);
  const [tileDisplayFields, setTileDisplayFields] = useState<LibraryTileDisplayField[]>(() => {
    try {
      const raw = window.localStorage.getItem(LIBRARY_TILE_FIELDS_STORAGE_KEY);
      if (!raw) {
        return DEFAULT_TILE_FIELDS;
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return DEFAULT_TILE_FIELDS;
      }
      const allowed = new Set(DISPLAY_FIELD_OPTIONS.map((opt) => opt.id));
      const normalized = parsed.filter((value): value is LibraryTileDisplayField => typeof value === "string" && allowed.has(value as LibraryTileDisplayField));
      return normalized.length > 0 ? Array.from(new Set(normalized)) : DEFAULT_TILE_FIELDS;
    } catch {
      return DEFAULT_TILE_FIELDS;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(LIBRARY_TILE_FIELDS_STORAGE_KEY, JSON.stringify(tileDisplayFields));
    } catch {
      // ignore persistence failures (private mode, storage disabled, etc.)
    }
  }, [tileDisplayFields]);

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
    if (!showScanMenu && !showFieldsMenu) {
      return;
    }

    function handlePointerDown(event: MouseEvent): void {
      const target = event.target as Node;
      const clickedOutsideScanMenu =
        showScanMenu && scanMenuRef.current && !scanMenuRef.current.contains(target);
      const clickedOutsideFieldsMenu =
        showFieldsMenu && fieldsMenuRef.current && !fieldsMenuRef.current.contains(target);

      if (clickedOutsideScanMenu) {
        setShowScanMenu(false);
      }
      if (clickedOutsideFieldsMenu) {
        setShowFieldsMenu(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showScanMenu, showFieldsMenu]);

  function toggleField(field: LibraryTileDisplayField): void {
    setTileDisplayFields((current) => {
      if (current.includes(field)) {
        const next = current.filter((value) => value !== field);
        return next.length > 0 ? next : current;
      }
      return [...current, field];
    });
  }

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
            <div className="inline-actions library-toolbar">
              <div className="toolbar-group">
                <span className="toolbar-group-label">View</span>
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
                <div className="scan-popup-anchor" ref={fieldsMenuRef}>
                  <button
                    className="secondary-button"
                    onClick={() => setShowFieldsMenu((current) => !current)}
                    type="button"
                  >
                    Movie fields
                  </button>
                  {showFieldsMenu && (
                    <div className="scan-mode-popup fields-popup">
                      <div className="fields-popup-header">
                        <span className="fields-popup-title">Show on cards</span>
                        <button
                          className="fields-popup-reset"
                          onClick={() => setTileDisplayFields(DEFAULT_TILE_FIELDS)}
                          type="button"
                        >
                          Reset
                        </button>
                      </div>
                      <div className="fields-popup-grid">
                        {DISPLAY_FIELD_OPTIONS.map((option) => (
                          <label className="fields-popup-item" key={option.id}>
                            <input
                              type="checkbox"
                              checked={tileDisplayFields.includes(option.id)}
                              onChange={() => toggleField(option.id)}
                            />
                            <span>{option.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="toolbar-group">
                <span className="toolbar-group-label">Scan</span>
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
              </div>

              <div className="toolbar-group">
                <span className="toolbar-group-label">Manual</span>
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
                displayFields={tileDisplayFields}
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
