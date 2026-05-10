import { memo, useEffect, useMemo, useState } from "react";
import type { MovieRecord } from "../../../shared/contracts";

const posterRecoveryAttempted = new Set<string>();

function normalizePosterUrl(posterUrl: string | null): string | null {
  if (!posterUrl) {
    return null;
  }

  const trimmed = posterUrl.trim();
  if (!trimmed) {
    return null;
  }

  if (/^(data:|blob:|https?:|file:\/\/)/i.test(trimmed)) {
    return trimmed;
  }

  const windowsPath = /^[a-z]:[\\/]/i.test(trimmed);
  const uncPath = /^\\\\/.test(trimmed);
  const unixPath = trimmed.startsWith("/");
  if (!(windowsPath || uncPath || unixPath)) {
    return trimmed;
  }

  const normalized = trimmed.replace(/\\/g, "/");
  // Keep drive-letter separators valid while encoding spaces and unsafe characters.
  return encodeURI(`file:///${normalized}`.replace(/file:\/\/(\/[a-z]:)/i, "file://$1"));
}

function getPosterToneClass(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i += 1) {
    hash = (hash * 31 + title.charCodeAt(i)) >>> 0;
  }
  return `poster-tone-${hash % 6}`;
}

export const PosterVisual = memo(function PosterVisual(props: {
  movie: MovieRecord;
  compact?: boolean;
  detail?: boolean;
}) {
  const { movie, compact = false, detail = false } = props;
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const posterSrc = useMemo(() => normalizePosterUrl(movie.posterUrl), [movie.posterUrl]);
  const posterToneClass = useMemo(() => getPosterToneClass(movie.title), [movie.title]);

  useEffect(() => {
    setImageLoadFailed(false);
  }, [movie.id, posterSrc]);

  const className = detail
    ? "poster-visual detail"
    : compact
      ? "poster-visual compact"
      : "poster-visual";

  const handleImageError = (): void => {
    setImageLoadFailed(true);

    if (!window.desktopApi || posterRecoveryAttempted.has(movie.id)) {
      return;
    }

    posterRecoveryAttempted.add(movie.id);
    void window.desktopApi
      .refreshMoviePosters([movie.id])
      .then((summary) => {
        if (summary.updated > 0) {
          window.dispatchEvent(new Event("mla:poster-recovery-complete"));
        }
      })
      .catch(() => undefined);
  };

  return (
    <div className={className}>
      {posterSrc && !imageLoadFailed ? (
        <img
          alt={movie.title}
          className="poster-image"
          loading="lazy"
          onError={handleImageError}
          src={posterSrc}
        />
      ) : (
        <div className={`poster-fallback ${posterToneClass}`}>
          <div className="poster-fallback-content">
            <span>{movie.libraryMode}</span>
            <strong>{movie.title}</strong>
            <small>
              {movie.year ?? "Unknown year"} · {movie.resolution}
            </small>
          </div>
        </div>
      )}
      <div className="poster-shade" />
    </div>
  );
});
