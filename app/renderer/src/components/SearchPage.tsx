import { useEffect, useMemo, useState } from "react";
import type {
  AppPage,
  MovieRecord,
  SubtitleGenerationLanguage,
  SubtitleGenerationModel,
  SubtitleGenerationOutputMode,
  SubtitleGenerationResult
} from "../../../shared/contracts";

interface SearchPageProps {
  movies: MovieRecord[];
  setSelectedMovieId: (id: string) => void;
  setActivePage: (page: AppPage) => void;
  onSubtitleGenerated: () => Promise<void>;
}

export function SearchPage({ movies, setSelectedMovieId, setActivePage, onSubtitleGenerated }: SearchPageProps) {
  const desktopApi = window.desktopApi;
  const [selectedMovieId, setSelectedMovieIdLocal] = useState<string>(movies[0]?.id ?? "");
  const [language, setLanguage] = useState<SubtitleGenerationLanguage>("auto");
  const [model, setModel] = useState<SubtitleGenerationModel>("medium");
  const [outputMode, setOutputMode] = useState<SubtitleGenerationOutputMode>("library-default");
  const [customFileName, setCustomFileName] = useState("subtitle");
  const [status, setStatus] = useState<SubtitleGenerationResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [batchMessage, setBatchMessage] = useState<string>("");
  const selectedMovie = useMemo(
    () => movies.find((movie) => movie.id === selectedMovieId) ?? null,
    [movies, selectedMovieId]
  );

  useEffect(() => {
    if (!selectedMovieId && movies[0]?.id) {
      setSelectedMovieIdLocal(movies[0].id);
    }
  }, [movies, selectedMovieId]);

  async function handleGenerate(): Promise<void> {
    if (!desktopApi || !selectedMovie) {
      return;
    }

    setIsGenerating(true);
    setStatus(null);
    try {
      const result = await desktopApi.generateSubtitleForMovie(selectedMovie.id, {
        language,
        model,
        outputMode,
        customFileName
      });
      setStatus(result);
      if (result.ok) {
        await onSubtitleGenerated();
      }
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleGenerateBatch(): Promise<void> {
    if (!desktopApi || movies.length === 0) {
      return;
    }

    setIsGenerating(true);
    setStatus(null);
    setBatchMessage("");
    let successCount = 0;
    let failureCount = 0;

    try {
      for (const movie of movies) {
        const result = await desktopApi.generateSubtitleForMovie(movie.id, {
          language,
          model,
          outputMode,
          customFileName
        });
        if (result.ok) {
          successCount += 1;
        } else {
          failureCount += 1;
          setStatus(result);
        }
      }
      await onSubtitleGenerated();
      setBatchMessage(`Batch complete. ${successCount} succeeded, ${failureCount} failed.`);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <section className="page">
      <div className="panel">
        <p className="eyebrow">Sub-Gen</p>
        <h3>Generate local subtitles with Faster-Whisper</h3>
        <p className="subtle">
          Local subtitle generation for library files. By default you can keep the original spoken language, translate to English, or translate to Chinese with a local translation model.
        </p>
        <div className="home-status-list mb-1rem">
          <div>
            <label htmlFor="model-select"><strong>Model</strong></label>
            <span>
              <select id="model-select" value={model} onChange={(event) => setModel(event.target.value as SubtitleGenerationModel)} aria-label="Model">
                <option value="small">Fast preview (small)</option>
                <option value="medium">Balanced (medium)</option>
                <option value="large-v3">Best accuracy (large-v3)</option>
              </select>
            </span>
          </div>
          <div>
            <label htmlFor="language-select"><strong>Mode</strong></label>
            <span>
              <select id="language-select" value={language} onChange={(event) => setLanguage(event.target.value as SubtitleGenerationLanguage)} aria-label="Language">
                <option value="auto">Auto detect / original language</option>
                <option value="translate-en">Translate to English</option>
                <option value="translate-zh">Translate to Chinese</option>
                <option value="translate-km">Translate to Khmer</option>
              </select>
            </span>
          </div>
          <div>
            <label htmlFor="output-select"><strong>Output</strong></label>
            <span>
              <select id="output-select" value={outputMode} onChange={(event) => setOutputMode(event.target.value as SubtitleGenerationOutputMode)} aria-label="Output">
                <option value="library-default">Same as video name</option>
                <option value="output-srt">output.srt</option>
                <option value="custom-name">Custom name</option>
              </select>
            </span>
          </div>
          {outputMode === "custom-name" && (
            <div>
              <label htmlFor="custom-output-name"><strong>Custom filename</strong></label>
              <span>
                <input
                  id="custom-output-name"
                  value={customFileName}
                  onChange={(event) => setCustomFileName(event.target.value)}
                  placeholder="subtitle"
                  aria-label="Custom filename"
                />
              </span>
            </div>
          )}
          <div>
            <strong>Profile</strong>
            <span>
              {model === "small"
                ? "Fastest local preview, lower accuracy."
                : model === "medium"
                ? "Balanced speed and accuracy."
                : "Slowest local run, highest accuracy."}
            </span>
          </div>
        </div>
        <div className="inline-actions mb-1rem">
          <button className="primary-button" disabled={!selectedMovie || isGenerating} onClick={() => void handleGenerate()} type="button">
            {isGenerating ? "Generating subtitles..." : "Generate subtitle"}
          </button>
          <button className="ghost-button" disabled={movies.length === 0 || isGenerating} onClick={() => void handleGenerateBatch()} type="button">
            {isGenerating ? "Running batch..." : `Batch generate visible (${movies.length})`}
          </button>
          {selectedMovie && (
            <button
              className="ghost-button"
              onClick={() => {
                setSelectedMovieId(selectedMovie.id);
                setActivePage("library");
              }}
              type="button"
            >
              Open in library
            </button>
          )}
        </div>
        {status && (
          <div className="panel mb-1rem">
            <p className="eyebrow">Generator status</p>
            <h3>{status.ok ? "Subtitle created" : "Generation blocked"}</h3>
            <p className="subtle">{status.message}</p>
            {status.detectedLanguage && status.outputLanguage && (
              <p className="subtle">
                Detected: {status.detectedLanguage} -&gt; Output: {status.outputLanguage}
              </p>
            )}
            {status.subtitlePath && (
              <div className="inline-actions">
                <button className="ghost-button" onClick={() => void desktopApi?.showInFolder(status.subtitlePath!)} type="button">
                  Show subtitle file
                </button>
              </div>
            )}
          </div>
        )}
        {batchMessage && (
          <div className="panel mb-1rem">
            <p className="eyebrow">Batch status</p>
            <h3>Batch subtitle generation</h3>
            <p className="subtle">{batchMessage}</p>
          </div>
        )}
        <div className="search-results">
          {movies.map((movie) => (
            <button
              className={`search-result${movie.id === selectedMovieId ? " active" : ""}`}
              key={movie.id}
              onClick={() => {
                setSelectedMovieIdLocal(movie.id);
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
