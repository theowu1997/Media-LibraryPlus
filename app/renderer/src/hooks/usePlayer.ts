import { useEffect, useRef, useState } from "react";
import type {
  MovieRecord,
  OnlineSubtitleResult,
  PlayerSettings,
} from "../../../shared/contracts";
import { srtToVtt } from "../utils";

type DesktopApi = NonNullable<typeof window.desktopApi>;

interface UsePlayerOptions {
  desktopApi: DesktopApi | undefined;
  /** Current paged movie list — used as playlist fallback */
  movies: MovieRecord[];
  /** Full movie pool for actress directory — preferred playlist source */
  allMoviesPool: MovieRecord[];
}

export function usePlayer({ desktopApi, movies, allMoviesPool }: UsePlayerOptions) {
  // ── Refs ──────────────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerConfigRef = useRef<HTMLDivElement>(null);
  const positionMemoryRef = useRef<Map<string, number>>(new Map());

  // Stable refs to latest values — used inside event-listener closures
  const playerMovieIdRef = useRef<string | null>(null);
  const playerSettingsRef = useRef<PlayerSettings>({
    defaultVolume: 1,
    subtitleFontSize: 20,
    subtitleColor: "#ffffff",
    autoPlayNext: false,
    rememberPosition: true,
    seekDuration: 10,
  });
  const moviesRef = useRef<MovieRecord[]>(movies);
  moviesRef.current = movies;
  const allMoviesPoolRef = useRef<MovieRecord[]>(allMoviesPool);
  allMoviesPoolRef.current = allMoviesPool;

  // ── State ─────────────────────────────────────────────────────────────────
  const [playerMovieId, setPlayerMovieId] = useState<string | null>(null);
  const [playerFileUrl, setPlayerFileUrl] = useState<string | null>(null);
  const [playerPlaying, setPlayerPlaying] = useState(false);
  const [playerVolume, setPlayerVolume] = useState(1);
  const [playerMuted, setPlayerMuted] = useState(false);
  const [playerCurrentTime, setPlayerCurrentTime] = useState(0);
  const [playerDuration, setPlayerDuration] = useState(0);
  const [playerPlaybackError, setPlayerPlaybackError] = useState<string | null>(null);
  const [playerSubtitles, setPlayerSubtitles] = useState<OnlineSubtitleResult[]>([]);
  const [playerSubTrackUrl, setPlayerSubTrackUrl] = useState<string | null>(null);
  const [playerSubTrackLang, setPlayerSubTrackLang] = useState<string>("und");
  const [playerSubLoading, setPlayerSubLoading] = useState(false);
  const [playerSubSearching, setPlayerSubSearching] = useState(false);
  const [playerShowSubPanel, setPlayerShowSubPanel] = useState(false);
  const [playerSubLangFilter, setPlayerSubLangFilter] = useState<string>("all");
  const [playerSubTargetLang, setPlayerSubTargetLang] = useState<string>("en");
  const [playerSubDownloadingId, setPlayerSubDownloadingId] = useState<string | null>(null);
  const [playerSubHasSearched, setPlayerSubHasSearched] = useState(false);
  const [playerSettings, setPlayerSettings] = useState<PlayerSettings>({
    defaultVolume: 1,
    subtitleFontSize: 20,
    subtitleColor: "#ffffff",
    autoPlayNext: false,
    rememberPosition: true,
    seekDuration: 10,
  });
  const [playerShowMovieList, setPlayerShowMovieList] = useState(false);
  const [playerHoveredMovieId, setPlayerHoveredMovieId] = useState<string | null>(null);
  const [playerRate, setPlayerRate] = useState(1);
  const [playerShowConfig, setPlayerShowConfig] = useState(false);
  const [playerIsFullscreen, setPlayerIsFullscreen] = useState(false);

  // Keep stable refs in sync with latest state
  playerMovieIdRef.current = playerMovieId;
  playerSettingsRef.current = playerSettings;

  // ── Effects ───────────────────────────────────────────────────────────────

  // Enable subtitle track programmatically — `default` attr is unreliable for dynamically-added tracks
  useEffect(() => {
    if (!playerSubTrackUrl || !videoRef.current) return;
    const video = videoRef.current;
    const enable = () => {
      for (let i = 0; i < video.textTracks.length; i++) {
        video.textTracks[i].mode = "showing";
      }
    };
    enable();
    const t = setTimeout(enable, 300);
    return () => clearTimeout(t);
  }, [playerSubTrackUrl]);

  // Revoke previous blob URL when subtitle track changes to avoid memory leaks
  useEffect(() => {
    return () => {
      if (playerSubTrackUrl) URL.revokeObjectURL(playerSubTrackUrl);
    };
  }, [playerSubTrackUrl]);

  // Sync volume & mute to video imperatively (React doesn't support `volume` as a prop)
  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.volume = playerVolume;
    videoRef.current.muted = playerMuted;
  }, [playerVolume, playerMuted]);

  useEffect(() => {
    if (!videoRef.current || !playerFileUrl) return;
    videoRef.current.load();
  }, [playerFileUrl]);

  // Sync playback rate to video element
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playerRate;
  }, [playerRate]);

  // Track OS-level fullscreen changes (e.g. Esc key)
  useEffect(() => {
    const handler = () => setPlayerIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Close player config panel when clicking outside both the panel and ⚙ button
  useEffect(() => {
    if (!playerShowConfig) return;
    function handleClickOutside(e: MouseEvent): void {
      const target = e.target as Node;
      const insideBtn = playerConfigRef.current?.contains(target);
      const insidePanel = (target as Element).closest?.(".player-config-panel");
      if (!insideBtn && !insidePanel) {
        setPlayerShowConfig(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [playerShowConfig]);

  // ── Functions ─────────────────────────────────────────────────────────────

  function applySubtitle(srtContent: string, lang = "und"): void {
    const vtt = srtToVtt(srtContent);
    const blob = new Blob([vtt], { type: "text/vtt" });
    const url = URL.createObjectURL(blob);
    setPlayerSubTrackLang(lang);
    setPlayerSubTrackUrl(url);
  }

  async function loadMovieIntoPlayer(movie: MovieRecord): Promise<void> {
    if (!desktopApi) return;
    // Save current position before switching movies
    if (playerMovieIdRef.current && playerSettingsRef.current.rememberPosition && videoRef.current) {
      const t = videoRef.current.currentTime;
      if (t > 5) positionMemoryRef.current.set(playerMovieIdRef.current, t);
    }
    setPlayerMovieId(movie.id);
    setPlayerSubTrackUrl(null);
    setPlayerSubTrackLang("und");
    setPlayerSubLangFilter("all");
    setPlayerSubTargetLang("en");
    setPlayerSubDownloadingId(null);
    setPlayerSubHasSearched(false);
    setPlayerPlaybackError(null);
    setPlayerCurrentTime(0);
    setPlayerDuration(0);
    setPlayerPlaying(false);
    const fileUrl = await desktopApi.playerGetFileUrl(movie.sourcePath, movie.folderPath);
    setPlayerFileUrl(fileUrl);
    // Auto-load first local subtitle if available
    if (movie.subtitles.length > 0) {
      const localSub = movie.subtitles[0];
      try {
        const content = await desktopApi.playerDownloadSubtitle(
          `file:///${localSub.path.replace(/\\/g, "/")}`
        );
        if (content) applySubtitle(content, localSub.language || "und");
      } catch { /* ignore */ }
    }
  }

  async function handleDownloadSubtitle(sub: OnlineSubtitleResult): Promise<void> {
    if (!desktopApi) return;
    setPlayerSubDownloadingId(sub.id);
    setPlayerSubLoading(true);
    try {
      const content = await desktopApi.playerDownloadSubtitle(sub.downloadUrl);
      if (content) {
        applySubtitle(content, sub.languageCode || "und");
        setPlayerShowSubPanel(false);
      }
    } catch { /* ignore */ }
    setPlayerSubDownloadingId(null);
    setPlayerSubLoading(false);
  }

  async function handleSearchSubtitles(videoId: string): Promise<void> {
    if (!desktopApi) return;
    setPlayerSubSearching(true);
    setPlayerSubtitles([]);
    setPlayerSubHasSearched(false);
    try {
      const all = await desktopApi.playerFetchSubtitles(videoId);
      const filtered =
        playerSubTargetLang === "all"
          ? all
          : all.filter((s) => matchesTargetLanguage(s, playerSubTargetLang));
      setPlayerSubtitles(filtered.sort((left, right) => right.downloads - left.downloads || left.title.localeCompare(right.title)));
    } catch { /* ignore */ }
    setPlayerSubHasSearched(true);
    setPlayerSubSearching(false);
  }

  async function convertMovieToMp4(movie: MovieRecord): Promise<boolean> {
    if (!desktopApi) return false;
    setPlayerPlaybackError(null);
    setPlayerPlaying(false);
    try {
      const result = await desktopApi.playerConvertToMp4(movie.sourcePath);
      if (result?.ok && result.url) {
        setPlayerFileUrl(result.url);
        return true;
      }
      if (result && !result.ok && result.error) {
        setPlayerPlaybackError(`Conversion failed: ${result.error}`);
        return false;
      }
    } catch { /* ignore */ }
    setPlayerPlaybackError("Conversion failed. The video could not be transcoded.");
    return false;
  }

  function matchesTargetLanguage(subtitle: OnlineSubtitleResult, targetLang: string): boolean {
    const code = subtitle.languageCode.toLowerCase();
    const language = subtitle.language.toLowerCase();
    const target = targetLang.toLowerCase();

    if (target === "all") {
      return true;
    }

    if (target === "zh-hans") {
      return code === "zh-hans" || code === "zh" || code === "zh-cn" || code === "zh-sg" || language.includes("simplified");
    }

    if (target === "zh-hant") {
      return code === "zh-hant" || code === "zh-tw" || code === "zh-hk" || code === "zh-mo" || language.includes("traditional");
    }

    if (target === "zh") {
      return code.startsWith("zh") || language.includes("chinese");
    }

    return (
      code === target ||
      code.startsWith(`${target}-`) ||
      language === target ||
      language.startsWith(`${target} `)
    );
  }

  /** Navigate to next/previous movie in the playlist */
  function navigatePlaylist(direction: 1 | -1): void {
    const pool = allMoviesPoolRef.current.length > 0 ? allMoviesPoolRef.current : moviesRef.current;
    const idx = pool.findIndex((m) => m.id === playerMovieIdRef.current);
    if (direction === 1 && idx >= 0 && idx < pool.length - 1) {
      void loadMovieIntoPlayer(pool[idx + 1]);
    } else if (direction === -1 && idx > 0) {
      void loadMovieIntoPlayer(pool[idx - 1]);
    }
  }

  return {
    // Refs
    videoRef,
    playerContainerRef,
    playerConfigRef,
    playerMovieIdRef,
    positionMemoryRef,
    // State
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
    // Functions
    loadMovieIntoPlayer,
    convertMovieToMp4,
    applySubtitle,
    handleDownloadSubtitle,
    handleSearchSubtitles,
    navigatePlaylist,
  };
}
