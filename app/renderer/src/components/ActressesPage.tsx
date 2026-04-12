import type React from "react";
import type { AppPage, LibraryMode, MovieRecord } from "../../../shared/contracts";
import { MovieTile } from "./MovieTile";

interface ActressEntry {
  name: string;
  count: number;
  posterUrl: string | null;
  movieIds: string[];
  inferred: boolean;
  modes: LibraryMode[];
}

interface ActressesPageProps {
  actressDirectory: ActressEntry[];
  selectedActress: string | null;
  setSelectedActress: (name: string | null) => void;
  actressGridCols: number;
  changeActressGridCols: (cols: number) => void;
  actressModeFilter: "all" | LibraryMode;
  setActressModeFilter: (mode: "all" | LibraryMode) => void;
  gentleUnlocked: boolean;
  isRefreshingActressPhotos: boolean;
  setIsRefreshingActressPhotos: (v: boolean) => void;
  actressPhotos: Record<string, string>;
  setActressPhotos: (photos: Record<string, string>) => void;
  allMoviesPool: MovieRecord[];
  movies: MovieRecord[];
  selectedMovieId: string | null;
  setSelectedMovieId: (id: string) => void;
  setActivePage: (page: AppPage) => void;
  setContextMenu: (menu: { movie: MovieRecord; x: number; y: number } | null) => void;
  onRefreshActressPhotos: () => Promise<void>;
}

export function ActressesPage({
  actressDirectory,
  selectedActress,
  setSelectedActress,
  actressGridCols,
  changeActressGridCols,
  actressModeFilter,
  setActressModeFilter,
  gentleUnlocked,
  isRefreshingActressPhotos,
  allMoviesPool,
  movies,
  selectedMovieId,
  setSelectedMovieId,
  setActivePage,
  setContextMenu,
  onRefreshActressPhotos,
}: ActressesPageProps) {
  const activeActressEntry = selectedActress
    ? actressDirectory.find((a) => a.name === selectedActress)
    : null;
  const actressMovies = activeActressEntry
    ? (allMoviesPool.length > 0 ? allMoviesPool : movies).filter((m) =>
        activeActressEntry.movieIds.includes(m.id)
      )
    : [];

  if (selectedActress && activeActressEntry) {
    return (
      <section className="page">
        <div className="panel">
          <div className="panel-header">
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <button
                className="ghost-button"
                onClick={() => setSelectedActress(null)}
                style={{ fontSize: "1.2rem", padding: "0.25rem 0.6rem" }}
                type="button"
              >
                ← Back
              </button>
              <div
                className="actress-avatar"
                style={{ width: 64, height: 64, flexShrink: 0, position: "relative" }}
              >
                {activeActressEntry.posterUrl ? (
                  <img
                    alt={activeActressEntry.name}
                    className="actress-avatar-img"
                    src={activeActressEntry.posterUrl}
                  />
                ) : (
                  <div className="actress-avatar-fallback" style={{ fontSize: "1.4rem" }}>
                    {activeActressEntry.name
                      .split(" ")
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <p className="eyebrow">Actress</p>
                <h3 style={{ margin: 0 }}>{activeActressEntry.name}</h3>
                <span className="actress-count">
                  {activeActressEntry.count} title{activeActressEntry.count !== 1 ? "s" : ""} in library
                </span>
              </div>
            </div>
          </div>
          <div
            className="movie-grid"
            style={{ "--cols": 4, marginTop: "1rem" } as React.CSSProperties}
          >
            {actressMovies.map((movie) => (
              <MovieTile
                key={movie.id}
                movie={movie}
                isActive={movie.id === selectedMovieId}
                separator="dot"
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ movie, x: e.clientX, y: e.clientY });
                }}
                onClick={() => {
                  setSelectedMovieId(movie.id);
                  setActivePage("library");
                }}
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Actress profiles</p>
            <h3>
              {actressDirectory.length} actress{actressDirectory.length !== 1 ? "es" : ""} in your
              library
            </h3>
          </div>
          <div className="actress-zoom-bar">
            <button
              className="actress-zoom-btn"
              disabled={actressGridCols >= 9}
              onClick={() => changeActressGridCols(actressGridCols + 1)}
              title="Zoom out"
              type="button"
            >
              −
            </button>
            <span className="actress-zoom-label">{actressGridCols}</span>
            <button
              className="actress-zoom-btn"
              disabled={actressGridCols <= 2}
              onClick={() => changeActressGridCols(actressGridCols - 1)}
              title="Zoom in"
              type="button"
            >
              +
            </button>
          </div>
          <button
            className="ghost-button"
            disabled={isRefreshingActressPhotos}
            onClick={() => void onRefreshActressPhotos()}
            type="button"
          >
            {isRefreshingActressPhotos ? "Fetching photos…" : "🔄 Refresh photos"}
          </button>
        </div>
        {/* Mode filter tabs */}
        <div className="actress-mode-tabs">
          {(["all", "normal", ...(gentleUnlocked ? ["gentle" as const] : [])] as const).map((mode) => {
            const pool = allMoviesPool.length > 0 ? allMoviesPool : movies;
            const visiblePool = gentleUnlocked ? pool : pool.filter((m) => m.libraryMode !== "gentle");
            const count =
              mode === "all"
                ? visiblePool.length
                : visiblePool.filter((m) => m.libraryMode === mode).length;
            return (
              <button
                key={mode}
                className={`actress-mode-tab${actressModeFilter === mode ? " active" : ""}`}
                onClick={() => {
                  setActressModeFilter(mode);
                  setSelectedActress(null);
                }}
                type="button"
              >
                {mode === "all" ? "All" : mode === "normal" ? "📂 Normal" : "🔒 Gentle"}
                <span className="actress-mode-count">
                  {count} titles
                </span>
              </button>
            );
          })}
        </div>
        {actressDirectory.length > 0 ? (
          <div
            className="actress-grid"
            style={{ "--actress-cols": actressGridCols } as React.CSSProperties}
          >
            {actressDirectory.map((actress) => (
              <button
                className="actress-card"
                key={actress.name}
                onClick={() => setSelectedActress(actress.name)}
                title={`View ${actress.name}'s titles`}
                type="button"
              >
                <div className="actress-photo">
                  <div className="actress-avatar">
                    {actress.posterUrl ? (
                      <img
                        alt={actress.name}
                        className="actress-avatar-img"
                        src={actress.posterUrl}
                      />
                    ) : (
                      <div className="actress-avatar-fallback">
                        {actress.name
                          .split(" ")
                          .map((w) => w[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="actress-overlay">
                    <strong className="actress-name">{actress.name}</strong>
                    <span className="actress-count">
                      {actress.count} title{actress.count !== 1 ? "s" : ""}
                      {actress.inferred ? " · 📁" : ""}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="subtle">
            {allMoviesPool.length === 0 && movies.length === 0
              ? "Scan your library first to see actresses here."
              : `No actresses found in ${actressModeFilter === "all" ? "your library" : `${actressModeFilter} mode`}.`}
          </p>
        )}
      </div>
    </section>
  );
}
