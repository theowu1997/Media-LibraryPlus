import type { AppShellState, MovieRecord } from "../../../shared/contracts";
import { SamplePosterCard } from "./SamplePosterCard";

const popularSamples = [
  { title: "Spider-Man", year: "2018", accent: "linear-gradient(180deg, #f44336, #102c61)" },
  { title: "Iron Man", year: "2008", accent: "linear-gradient(180deg, #ff8a00, #661d00)" },
  { title: "Batman", year: "2022", accent: "linear-gradient(180deg, #1a1d24, #48546a)" },
  { title: "Avengers", year: "2019", accent: "linear-gradient(180deg, #4f46e5, #090b24)" },
  { title: "Avatar", year: "2022", accent: "linear-gradient(180deg, #00bcd4, #0a2147)" },
  { title: "Interstellar", year: "2014", accent: "linear-gradient(180deg, #263238, #090c1a)" }
] as const;

interface HomePageProps {
  movies: MovieRecord[];
  appState: AppShellState;
}

export function HomePage({ movies, appState }: HomePageProps) {
  return (
    <section className="page">
      <div className="hero-card">
        <div>
          <p className="eyebrow">Pipeline</p>
          <h3>Scan, classify, organize, then act from one desktop shell.</h3>
          <p>
            The renderer talks to Electron through IPC, while the main process
            owns file access, database writes, and future FFmpeg jobs.
          </p>
        </div>
        <div className="hero-metrics">
          <div className="metric">
            <strong>{movies.length}</strong>
            <span>Visible titles</span>
          </div>
          <div className="metric">
            <strong>{appState.roots.normal.length}</strong>
            <span>Normal roots</span>
          </div>
          <div className="metric">
            <strong>{appState.gentleUnlocked ? appState.roots.gentle.length : 0}</strong>
            <span>Gentle roots</span>
          </div>
        </div>
      </div>

      <section className="row-block">
        <div className="row-header">
          <h3>Popular picks</h3>
          <span>Built-in sample posters</span>
        </div>
        <div className="poster-row">
          {popularSamples.map((sample) => (
            <SamplePosterCard key={sample.title} sample={sample} />
          ))}
        </div>
      </section>

      <section className="panel">
        <p className="eyebrow">Dashboard</p>
        <h3>Imported media stays in Library</h3>
        <p className="subtle">
          Home now shows only featured content and app status. Your imported titles
          are available in the Library page and Search page, not on the dashboard.
        </p>
      </section>
    </section>
  );
}
