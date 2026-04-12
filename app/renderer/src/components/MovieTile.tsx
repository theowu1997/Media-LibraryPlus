import type { MovieRecord } from "../../../shared/contracts";
import { PosterVisual } from "./PosterVisual";

interface MovieTileProps {
  movie: MovieRecord;
  isActive: boolean;
  isSelected?: boolean;
  showCheckbox?: boolean;
  onContextMenu: (e: React.MouseEvent) => void;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onToggleSelect?: () => void;
  separator?: "dash" | "dot";
}

export function MovieTile({
  movie,
  isActive,
  isSelected = false,
  showCheckbox = false,
  onContextMenu,
  onClick,
  onToggleSelect,
  separator = "dash",
}: MovieTileProps) {
  const sep = separator === "dot" ? " · " : " - ";
  return (
    <article
      className={[
        "movie-tile",
        isActive ? "active" : "",
        isSelected ? "selected" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-movie-id={movie.id}
      key={movie.id}
      onContextMenu={onContextMenu}
    >
      {showCheckbox && onToggleSelect && (
        <label className="tile-check">
          <input
            checked={isSelected}
            onChange={onToggleSelect}
            type="checkbox"
          />
          <span />
        </label>
      )}
      <button className="tile-body" onClick={onClick} type="button">
        <PosterVisual movie={movie} />
        <div className="poster-content">
          <span className="mode-pill">{movie.libraryMode}</span>
          <strong>{movie.title}</strong>
          <small>
            {movie.year ?? "Unknown year"}{sep}{movie.resolution}
          </small>
          {separator === "dash" && (
            <small className="muted-path">{movie.sourcePath}</small>
          )}
        </div>
      </button>
    </article>
  );
}
