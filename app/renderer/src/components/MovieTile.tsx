import { memo } from "react";
import type { MovieRecord } from "../../../shared/contracts";
import { PosterVisual } from "./PosterVisual";

type MovieTileDisplayField =
  | "fullTitle"
  | "dvdId"
  | "actress"
  | "tag"
  | "genre"
  | "censored"
  | "uncensored"
  | "studio"
  | "year";

interface MovieTileProps {
  movie: MovieRecord;
  isActive: boolean;
  isSelected?: boolean;
  showCheckbox?: boolean;
  viewMode?: "grid" | "list";
  displayFields?: MovieTileDisplayField[];
  onContextMenu: (e: React.MouseEvent) => void;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onToggleSelect?: () => void;
  separator?: "dash" | "dot";
}

function MovieTileComponent({
  movie,
  isActive,
  isSelected = false,
  showCheckbox = false,
  viewMode = "grid",
  displayFields = ["fullTitle", "year"],
  onContextMenu,
  onClick,
  onToggleSelect,
  separator = "dash",
}: MovieTileProps) {
  const sep = separator === "dot" ? " · " : " - ";

  const fields = Array.from(new Set(displayFields));
  const showYear = fields.includes("year");

  const primaryField: "fullTitle" | "dvdId" =
    fields.includes("fullTitle") ? "fullTitle" : fields.includes("dvdId") ? "dvdId" : "fullTitle";

  const primaryText =
    primaryField === "dvdId" && movie.videoId ? movie.videoId : movie.title;

  const lowerKeywords = movie.keywords.map((keyword) => keyword.toLowerCase());
  const hasCensoredKeyword = lowerKeywords.some((keyword) => keyword.includes("censored") || keyword.includes("censor"));
  const hasUncensoredKeyword = lowerKeywords.some((keyword) => keyword.includes("uncensored") || keyword.includes("uncen"));

  const genres = movie.keywords
    .map((keyword) => {
      const match = keyword.match(/^\s*genre\s*[:=]\s*(.+)\s*$/i);
      return match?.[1]?.trim() ?? null;
    })
    .filter((value): value is string => Boolean(value));

  const studios = movie.keywords
    .map((keyword) => {
      const match = keyword.match(/^\s*studio\s*[:=]\s*(.+)\s*$/i);
      return match?.[1]?.trim() ?? null;
    })
    .filter((value): value is string => Boolean(value));

  const detailLines: Array<{ label: string; value: string }> = [];

  if (fields.includes("dvdId") && primaryField !== "dvdId") {
    detailLines.push({ label: "DVDID", value: movie.videoId ?? "—" });
  }

  if (fields.includes("actress")) {
    detailLines.push({ label: "Actress", value: movie.actresses.length > 0 ? movie.actresses.join(", ") : "—" });
  }

  if (fields.includes("tag")) {
    detailLines.push({ label: "Tag", value: movie.keywords.length > 0 ? movie.keywords.join(", ") : "—" });
  }

  if (fields.includes("genre")) {
    detailLines.push({ label: "Genre", value: genres.length > 0 ? genres.join(", ") : "—" });
  }

  if (fields.includes("studio")) {
    detailLines.push({ label: "Studio", value: studios.length > 0 ? studios.join(", ") : "—" });
  }

  if (fields.includes("censored")) {
    const value = hasCensoredKeyword ? "Yes" : hasUncensoredKeyword ? "No" : "Unknown";
    detailLines.push({ label: "Censored", value });
  }

  if (fields.includes("uncensored")) {
    const value = hasUncensoredKeyword ? "Yes" : hasCensoredKeyword ? "No" : "Unknown";
    detailLines.push({ label: "Uncensored", value });
  }

  return (
    <article
      className={[
        "movie-tile",
        viewMode === "list" ? "list" : "grid",
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
            aria-label="Select movie"
            title="Select movie"
          />
          <span />
        </label>
      )}
      <button className="tile-body" onClick={onClick} type="button">
        <div className="poster-shell">
          <PosterVisual movie={movie} />
          {viewMode === "grid" && movie.subtitles.length > 0 && (
            <span className="subtitle-watermark" title={`${movie.subtitles.length} subtitle file${movie.subtitles.length === 1 ? "" : "s"} detected`}>
              SRT
            </span>
          )}
        </div>
        <div className="poster-content">
          <span className="mode-pill">{movie.libraryMode}</span>
          <strong>{primaryText}</strong>
          <small>
            {showYear ? movie.year ?? "Unknown year" : movie.resolution}
            {showYear ? `${sep}${movie.resolution}` : ""}
          </small>
          {detailLines.map((line) => (
            <small key={line.label}>
              {line.label}: {line.value}
            </small>
          ))}
          {separator === "dash" && (
            <small className="muted-path">{movie.sourcePath}</small>
          )}
        </div>
      </button>
    </article>
  );
}

export const MovieTile = memo(MovieTileComponent, (prev, next) => {
  const prevFields = prev.displayFields?.join("|") ?? "";
  const nextFields = next.displayFields?.join("|") ?? "";
  return (
    prev.movie.id === next.movie.id &&
    prev.movie.title === next.movie.title &&
    prev.movie.posterUrl === next.movie.posterUrl &&
    prev.movie.year === next.movie.year &&
    prev.movie.resolution === next.movie.resolution &&
    prev.movie.libraryMode === next.movie.libraryMode &&
    prev.movie.sourcePath === next.movie.sourcePath &&
    prev.movie.subtitles.length === next.movie.subtitles.length &&
    prev.isActive === next.isActive &&
    prev.isSelected === next.isSelected &&
    prev.showCheckbox === next.showCheckbox &&
    prev.viewMode === next.viewMode &&
    prev.separator === next.separator &&
    prevFields === nextFields
  );
});
