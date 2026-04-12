import type { AppPage, MovieRecord } from "../../../shared/contracts";

interface SearchPageProps {
  movies: MovieRecord[];
  setSelectedMovieId: (id: string) => void;
  setActivePage: (page: AppPage) => void;
}

export function SearchPage({ movies, setSelectedMovieId, setActivePage }: SearchPageProps) {
  return (
    <section className="page">
      <div className="panel">
        <p className="eyebrow">Search</p>
        <h3>Real-time local lookup</h3>
        <p className="subtle">
          Search is backed by SQLite fields, stored video IDs, and file names, not a remote service.
        </p>
        <div className="search-results">
          {movies.map((movie) => (
            <button
              className="search-result"
              key={movie.id}
              onClick={() => {
                setSelectedMovieId(movie.id);
                setActivePage("library");
              }}
              type="button"
            >
              <strong>{movie.title}</strong>
              <span>
                {movie.videoId ? `${movie.videoId} - ` : ""}
                {movie.libraryMode} - {movie.sourcePath}
              </span>
              {movie.subtitles.length > 0 && (
                <span className="subtitle-badge">
                  💬 {movie.subtitles.length} sub{movie.subtitles.length !== 1 ? "s" : ""}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
