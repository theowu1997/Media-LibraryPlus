import type React from "react";
import { useState } from "react";
import type { MovieRecord, OnlineSubtitleResult, PlayerSettings } from "../../../shared/contracts";
import { formatTime } from "../utils";
import { extractStrictJavVideoIdCandidates, extractVideoIdCandidates } from "../../../shared/videoId";

interface PlayerPageProps {
  // movie data
  movies: MovieRecord[];
  allMoviesPool: MovieRecord[];
  playerMovieId: string | null;

  // video element refs
  videoRef: React.RefObject<HTMLVideoElement>;
  playerContainerRef: React.RefObject<HTMLElement>;
  playerConfigRef: React.RefObject<HTMLElement>;

  // playback state
  playerFileUrl: string | null;
  playerPlaying: boolean;
  playerMuted: boolean;
  playerVolume: number;
  playerRate: number;
  playerCurrentTime: number;
  playerDuration: number;
  playerPlaybackError: string | null;
  playerIsFullscreen: boolean;
  playerSettings: PlayerSettings;

  // UI state
  playerShowConfig: boolean;
  playerShowMovieList: boolean;
  playerHoveredMovieId: string | null;
  playerShowSubPanel: boolean;

  // subtitle state
  playerSubTrackUrl: string | null;
  playerSubTrackLang: string;
  playerSubTargetLang: string;
  playerSubtitles: OnlineSubtitleResult[];
  playerSubSearching: boolean;
  playerSubHasSearched: boolean;
  playerSubDownloadingId: string | null;

  // setters
  setPlayerPlaying: (v: boolean) => void;
  setPlayerMuted: (v: boolean) => void;
  setPlayerVolume: (v: number) => void;
  setPlayerRate: (v: number) => void;
  setPlayerCurrentTime: (v: number) => void;
  setPlayerDuration: (v: number) => void;
  setPlayerPlaybackError: (v: string | null) => void;
  setPlayerSettings: React.Dispatch<React.SetStateAction<PlayerSettings>>;
  setPlayerShowConfig: React.Dispatch<React.SetStateAction<boolean>>;
  setPlayerShowMovieList: React.Dispatch<React.SetStateAction<boolean>>;
  setPlayerHoveredMovieId: (id: string | null) => void;
  setPlayerShowSubPanel: React.Dispatch<React.SetStateAction<boolean>>;
  setPlayerSubTrackUrl: (url: string | null) => void;
  setPlayerSubTargetLang: (lang: string) => void;
  setPlayerSubtitles: React.Dispatch<React.SetStateAction<OnlineSubtitleResult[]>>;
  setPlayerSubHasSearched: (v: boolean) => void;

  // actions
  loadMovieIntoPlayer: (movie: MovieRecord) => Promise<void>;
  navigatePlaylist: (delta: 1 | -1) => void;
  applySubtitle: (content: string, lang: string) => void;
  handleSearchSubtitles: (videoId: string) => Promise<void>;
  handleDownloadSubtitle: (sub: OnlineSubtitleResult) => Promise<void>;
  convertMovieToMp4: (movie: MovieRecord) => Promise<boolean>;

  // desktop api
  playerSaveSettings: (settings: PlayerSettings) => Promise<void>;
  playerDownloadSubtitleFile: (url: string) => Promise<string | null>;
  playerOpenFile: (filePath: string) => Promise<void>;
  playerShowInFolder: (filePath: string) => Promise<void>;
}

export function PlayerPage({
  movies,
  allMoviesPool,
  playerMovieId,
  videoRef,
  playerContainerRef,
  playerConfigRef,
  playerFileUrl,
  playerPlaying,
  playerMuted,
  playerVolume,
  playerRate,
  playerCurrentTime,
  playerDuration,
  playerPlaybackError,
  playerIsFullscreen,
  playerSettings,
  playerShowConfig,
  playerShowMovieList,
  playerHoveredMovieId,
  playerShowSubPanel,
  playerSubTrackUrl,
  playerSubTrackLang,
  playerSubTargetLang,
  playerSubtitles,
  playerSubSearching,
  playerSubHasSearched,
  playerSubDownloadingId,
  setPlayerPlaying,
  setPlayerMuted,
  setPlayerVolume,
  setPlayerRate,
  setPlayerCurrentTime,
  setPlayerDuration,
  setPlayerPlaybackError,
  setPlayerSettings,
  setPlayerShowConfig,
  setPlayerShowMovieList,
  setPlayerHoveredMovieId,
  setPlayerShowSubPanel,
  setPlayerSubTrackUrl,
  setPlayerSubTargetLang,
  setPlayerSubtitles,
  setPlayerSubHasSearched,
  loadMovieIntoPlayer,
  navigatePlaylist,
  applySubtitle,
  handleSearchSubtitles,
  handleDownloadSubtitle,
  convertMovieToMp4,
  playerSaveSettings,
  playerDownloadSubtitleFile,
  playerOpenFile,
}: PlayerPageProps) {
  const [isConverting, setIsConverting] = useState(false);
  const playerMovie = movies.find((m) => m.id === playerMovieId) ?? null;
  const allPlayerMovies = allMoviesPool.length > 0 ? allMoviesPool : movies;
  const currentVideoSearchId = (() => {
    if (!playerMovie) return "";
    const stem = (playerMovie.sourcePath ?? "").split(/[\\/]/).pop() ?? "";
    const basename = stem.replace(/\.[^/.]+$/, "");
    return (
      extractStrictJavVideoIdCandidates(basename)[0] ??
      extractVideoIdCandidates(basename)[0] ??
      ""
    );
  })();

  return (
    <section className="page player-page" ref={playerContainerRef}>
      {/* Top bar: now-playing title + actions */}
      <div className="player-topbar">
        <div className="player-now-playing">
          {playerMovie?.posterUrl && (
            <img src={playerMovie.posterUrl} alt="" className="player-pick-thumb" />
          )}
          <span className="player-pick-title">
            {playerMovie ? playerMovie.title : "No movie selected"}
          </span>
        </div>
        <div className="player-topbar-actions">
          <button
            className={`ghost-button${playerShowSubPanel ? " active" : ""}`}
            onClick={() => setPlayerShowSubPanel((v) => !v)}
            title="Subtitles"
            type="button"
          >
            CC {playerSubSearching ? "…" : playerSubtitles.length > 0 ? `(${playerSubtitles.length})` : ""}
          </button>
          {/* Compact movie picker */}
          <div className="player-movie-selector">
            <button
              className={`ghost-button${playerShowMovieList ? " active" : ""}`}
              onClick={() => setPlayerShowMovieList((v) => !v)}
              type="button"
              title="Pick movie"
            >
              ≡ Movies
            </button>
            {playerShowMovieList && (
              <div className="player-movie-dropdown">
                {playerHoveredMovieId && (() => {
                  const hm = allPlayerMovies.find((x) => x.id === playerHoveredMovieId);
                  return hm?.posterUrl ? (
                    <div className="player-poster-preview">
                      <img src={hm.posterUrl} alt={hm.title} />
                    </div>
                  ) : null;
                })()}
                {allPlayerMovies.length === 0 ? (
                  <p className="subtle" style={{ padding: "1rem" }}>No movies in library</p>
                ) : allPlayerMovies.map((m) => (
                  <button
                    key={m.id}
                    className={`player-movie-item${m.id === playerMovieId ? " active" : ""}`}
                    onClick={() => { void loadMovieIntoPlayer(m); setPlayerShowMovieList(false); setPlayerHoveredMovieId(null); }}
                    onMouseEnter={() => setPlayerHoveredMovieId(m.id)}
                    onMouseLeave={() => setPlayerHoveredMovieId(null)}
                    type="button"
                  >
                    <div className="player-dropdown-info">
                      <strong>{m.title}</strong>
                      <small>{m.videoId ?? m.libraryMode} · {m.year ?? "?"}</small>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="player-body">
        {/* Video */}
        <div className="player-video-wrap" onClick={() => {
          if (!videoRef.current) return;
          if (playerPlaying) { videoRef.current.pause(); setPlayerPlaying(false); }
          else { void videoRef.current.play(); setPlayerPlaying(true); }
        }}>
          {playerFileUrl ? (
            <video
              ref={videoRef}
              className="player-video"
              src={playerFileUrl}
              controls={Boolean(playerPlaybackError)}
              preload="metadata"
              playsInline
              muted={playerMuted}
              onPlay={() => { setPlayerPlaying(true); setPlayerPlaybackError(null); }}
              onPause={() => setPlayerPlaying(false)}
              onTimeUpdate={() => setPlayerCurrentTime(videoRef.current?.currentTime ?? 0)}
              onDurationChange={() => setPlayerDuration(videoRef.current?.duration ?? 0)}
              onLoadedMetadata={() => {
                setPlayerPlaybackError(null);
              }}
              onError={() => {
                const mediaError = videoRef.current?.error;
                const message =
                  mediaError?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
                    ? "This video format is not supported by the built-in player."
                    : mediaError?.code === MediaError.MEDIA_ERR_DECODE
                      ? "The video could not be decoded."
                      : "The video failed to load.";
                setPlayerPlaybackError(message);
                setPlayerPlaying(false);
              }}
              onEnded={() => {
                setPlayerPlaying(false);
                if (playerSettings.autoPlayNext) {
                  navigatePlaylist(1);
                }
              }}
              style={{ "--sub-size": `${playerSettings.subtitleFontSize}px`, "--sub-color": playerSettings.subtitleColor } as React.CSSProperties}
            >
              {playerSubTrackUrl && (
                <track
                  key={playerSubTrackUrl}
                  kind="subtitles"
                  src={playerSubTrackUrl}
                  srcLang={playerSubTrackLang}
                  label="Subtitle"
                  default
                />
              )}
            </video>
          ) : (
            <div className="player-empty">
              <p>▶ Select a movie to start playing</p>
            </div>
          )}
          {playerPlaybackError && (
            <div className="player-error">
              <strong>Playback error</strong>
              <p>{playerPlaybackError}</p>
              <div className="player-error-actions">
                <button className="player-btn" type="button" onClick={() => { if (playerMovie) void loadMovieIntoPlayer(playerMovie); }}>
                  Retry
                </button>
                {playerMovie && (
                  <button
                    className="player-btn"
                    type="button"
                    disabled={isConverting}
                    onClick={async () => {
                      setIsConverting(true);
                      await convertMovieToMp4(playerMovie);
                      setIsConverting(false);
                    }}
                  >
                    {isConverting ? "Converting…" : "Convert to MP4 and play"}
                  </button>
                )}
                {playerMovie && (
                  <button className="player-btn" type="button" onClick={() => void playerOpenFile(playerMovie.sourcePath)}>
                    Open in system player
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="player-controls" onClick={(e) => e.stopPropagation()}>
          {/* Config popover */}
          {playerShowConfig && (
            <div className="player-config-panel">
              <div className="player-config-section">
                <label>Speed</label>
                <div className="player-speed-grid">
                  {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3].map((s) => (
                    <button
                      key={s}
                      className={`player-speed-item${playerRate === s ? " active" : ""}`}
                      onClick={() => { setPlayerRate(s); if (videoRef.current) videoRef.current.playbackRate = s; }}
                      type="button"
                    >{s}×</button>
                  ))}
                </div>
              </div>
              <div className="player-config-section">
                <label>Subtitle size: {playerSettings.subtitleFontSize}px</label>
                <input type="range" min={12} max={48}
                  value={playerSettings.subtitleFontSize}
                  onChange={(e) => setPlayerSettings((s) => ({ ...s, subtitleFontSize: Number(e.target.value) }))}
                />
              </div>
              <div className="player-config-section">
                <label>Subtitle color</label>
                <input type="color" value={playerSettings.subtitleColor}
                  onChange={(e) => setPlayerSettings((s) => ({ ...s, subtitleColor: e.target.value }))}
                />
              </div>
              <div className="player-config-section player-config-row">
                <label>Auto-play next</label>
                <input type="checkbox" checked={playerSettings.autoPlayNext}
                  onChange={(e) => setPlayerSettings((s) => ({ ...s, autoPlayNext: e.target.checked }))}
                />
              </div>
              <div className="player-config-section player-config-row">
                <label>Remember position</label>
                <input type="checkbox" checked={playerSettings.rememberPosition}
                  onChange={(e) => setPlayerSettings((s) => ({ ...s, rememberPosition: e.target.checked }))}
                />
              </div>
              <div className="player-config-section">
                <button className="player-btn" type="button" style={{ width: "100%" }}
                  onClick={async () => {
                    await playerSaveSettings(playerSettings);
                    setPlayerVolume(playerSettings.defaultVolume);
                    setPlayerShowConfig(false);
                  }}>
                  Save settings
                </button>
              </div>
            </div>
          )}

          {/* Seek bar */}
          <input
            className="player-seek"
            type="range"
            min={0}
            max={playerDuration || 100}
            value={playerCurrentTime}
            onChange={(e) => {
              const t = Number(e.target.value);
              if (videoRef.current) videoRef.current.currentTime = t;
              setPlayerCurrentTime(t);
            }}
            style={{ "--pct": `${(playerCurrentTime / (playerDuration || 1)) * 100}%` } as React.CSSProperties}
          />
          <div className="player-controls-row">
            <div className="player-controls-left">
              <button className="player-btn" title="Previous (P)" type="button" onClick={() => {
                const idx = allPlayerMovies.findIndex((m) => m.id === playerMovieId);
                if (idx > 0) void loadMovieIntoPlayer(allPlayerMovies[idx - 1]);
              }}>⏮</button>
              <button className="player-btn" title="Seek -10s (←)" type="button" onClick={() => {
                if (!videoRef.current) return;
                videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
                setPlayerCurrentTime(videoRef.current.currentTime);
              }}>⏪</button>
              <button className="player-btn player-btn-main" type="button" title="Play / Pause (Space)" onClick={() => {
                if (!videoRef.current) return;
                if (playerPlaying) { videoRef.current.pause(); }
                else { void videoRef.current.play(); }
              }}>
                {playerPlaying ? "⏸" : "▶"}
              </button>
              <button className="player-btn" title="Seek +10s (→)" type="button" onClick={() => {
                if (!videoRef.current) return;
                videoRef.current.currentTime = Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + 10);
                setPlayerCurrentTime(videoRef.current.currentTime);
              }}>⏩</button>
              <button className="player-btn" title="Next (N)" type="button" onClick={() => {
                const idx = allPlayerMovies.findIndex((m) => m.id === playerMovieId);
                if (idx < allPlayerMovies.length - 1) void loadMovieIntoPlayer(allPlayerMovies[idx + 1]);
              }}>⏭</button>
              <span className="player-time">{formatTime(playerCurrentTime)} / {formatTime(playerDuration)}</span>
            </div>
            <div className="player-controls-right">
              <button className="player-btn" title="Mute (M)" onClick={() => {
                const next = !playerMuted;
                setPlayerMuted(next);
                if (videoRef.current) videoRef.current.muted = next;
              }} type="button">
                {playerMuted || playerVolume === 0 ? "🔇" : playerVolume > 0.5 ? "🔊" : "🔉"}
              </button>
              <input
                className="player-volume"
                type="range" min={0} max={1} step={0.05}
                value={playerMuted ? 0 : playerVolume}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setPlayerVolume(v);
                  setPlayerMuted(v === 0);
                  if (videoRef.current) { videoRef.current.volume = v; videoRef.current.muted = v === 0; }
                }}
              />
              <button
                className="player-btn"
                title="Speed — click to cycle  [ slower  ] faster  = normal"
                type="button"
                onClick={() => {
                  const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3];
                  const next = speeds[(speeds.indexOf(playerRate) + 1) % speeds.length];
                  setPlayerRate(next);
                }}
              >
                {playerRate}×
              </button>
              <button
                className={`player-btn${playerSubTrackUrl ? " active" : ""}`}
                onClick={() => { if (playerSubTrackUrl) setPlayerSubTrackUrl(null); else setPlayerShowSubPanel(true); }}
                title="Subtitles (CC)"
                type="button"
              >CC</button>
              <button className="player-btn" title="Fullscreen (F)" type="button"
                onClick={() => {
                  if (document.fullscreenElement) void document.exitFullscreen();
                  else void (playerContainerRef.current ?? videoRef.current)?.requestFullscreen?.();
                }}>
                {playerIsFullscreen ? "⊡" : "⛶"}
              </button>
              <div ref={playerConfigRef as React.RefObject<HTMLDivElement>} style={{ position: "relative", display: "inline-block" }}>                <button
                  className={`player-btn${playerShowConfig ? " active" : ""}`}
                  title="Player settings"
                  type="button"
                  onClick={() => setPlayerShowConfig((v) => !v)}
                >⚙</button>
              </div>
            </div>
          </div>
        </div>

        {/* Subtitle panel */}
        {playerShowSubPanel && (
          <div className="player-sub-panel">
            <div className="player-sub-header">
              <strong>Subtitles</strong>
              <button className="ghost-button" onClick={() => setPlayerShowSubPanel(false)} type="button">✕</button>
            </div>

            {playerSubTrackUrl && (
              <button className="player-sub-item active" onClick={() => { setPlayerSubTrackUrl(null); }} type="button">
                ✓ Subtitle active — click to remove
              </button>
            )}

            {playerMovie?.subtitles.map((sub) => (
              <button key={sub.id} className="player-sub-item" type="button"
                onClick={async () => {
                  const content = await playerDownloadSubtitleFile(`file:///${sub.path.replace(/\\/g, "/")}`);
                  if (content) { applySubtitle(content, sub.language || "und"); setPlayerShowSubPanel(false); }
                }}>
                📄 {sub.language || sub.path.split(/[\\/]/).pop()}
              </button>
            ))}

            <div className="player-sub-divider">Online — SubtitleCat</div>

            <div className="player-sub-search-row">
              <select
                className="player-sub-lang-select"
                value={playerSubTargetLang}
                onChange={(e) => { setPlayerSubTargetLang(e.target.value); setPlayerSubtitles([]); setPlayerSubHasSearched(false); }}
              >
                <option value="en">English</option>
                <option value="ja">Japanese</option>
                <option value="zh">Chinese</option>
                <option value="ko">Korean</option>
                <option value="fr">French</option>
                <option value="es">Spanish</option>
                <option value="de">German</option>
                <option value="pt">Portuguese</option>
                <option value="th">Thai</option>
                <option value="vi">Vietnamese</option>
                <option value="id">Indonesian</option>
                <option value="ar">Arabic</option>
                <option value="ru">Russian</option>
                <option value="it">Italian</option>
                <option value="all">All languages</option>
              </select>
              <button
                className="player-sub-search-btn"
                type="button"
                disabled={playerSubSearching || !currentVideoSearchId}
                onClick={() => {
                  if (currentVideoSearchId) void handleSearchSubtitles(currentVideoSearchId);
                }}
              >
                {playerSubSearching ? "Searching…" : "🔍 Search"}
              </button>
            </div>

            {!currentVideoSearchId && (
              <p className="player-sub-hint">No DVD ID detected in the current video file name.</p>
            )}
            {playerSubSearching && (
              <p className="player-sub-hint">Searching SubtitleCat…</p>
            )}
            {!playerSubSearching && playerSubtitles.length === 0 && currentVideoSearchId && (
              <p className="player-sub-hint">
                {playerSubHasSearched
                  ? `No results for "${currentVideoSearchId}".`
                  : "Press Search to find subtitles."}
              </p>
            )}

            {playerSubtitles.map((sub) => (
              <div key={sub.id} className="player-sub-result">
                <div className="player-sub-result-info">
                  <span className="player-sub-result-title">{sub.title}</span>
                  <span className="player-sub-result-lang">{sub.language}</span>
                  {sub.downloads > 0 && (
                    <span className="player-sub-result-downloads">⬇ {sub.downloads}</span>
                  )}
                </div>
                <button
                  className="player-sub-download-btn"
                  type="button"
                  disabled={playerSubDownloadingId === sub.id}
                  onClick={() => void handleDownloadSubtitle(sub)}
                >
                  {playerSubDownloadingId === sub.id ? "…" : "⬇ Download"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
