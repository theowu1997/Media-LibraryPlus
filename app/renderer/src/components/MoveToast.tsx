import type { MoveProgress } from "../../../shared/contracts";

interface MoveToastProps {
  moveProgress: MoveProgress;
  isMoving: boolean;
  progressPercent: number;
  onDismiss: () => void;
}

function stageLabel(progress: MoveProgress): string {
  if (progress.stage === "error") {
    return progress.error ? `Error: ${progress.error}` : "Move failed.";
  }
  if (progress.stage === "completed") {
    return "Move complete.";
  }
  return progress.message || "Moving...";
}

export function MoveToast({
  moveProgress,
  isMoving,
  progressPercent,
  onDismiss,
}: MoveToastProps) {
  return (
    <div className={`scan-toast move-toast${isMoving ? " active" : " done"}`}>
      <div className="scan-toast-top">
        <span className="scan-toast-label">
          {isMoving ? "📦 Moving files…" : moveProgress.stage === "error" ? "❌ Move failed" : "✅ Move complete"}
        </span>
        {!isMoving && (
          <button
            className="scan-toast-stop"
            onClick={onDismiss}
            title="Dismiss"
            type="button"
          >✕</button>
        )}
      </div>
      <div className="scan-toast-bar-track">
        <div className="scan-toast-bar-fill" style={{ width: `${progressPercent}%` }} />
      </div>
      <div className="scan-toast-info">
        <span className="scan-toast-pct">{progressPercent}%</span>
        <span className="scan-toast-count">
          {moveProgress.completedMovies}/{moveProgress.totalMovies} movies
        </span>
        <span className="scan-toast-msg">{stageLabel(moveProgress)}</span>
      </div>
    </div>
  );
}

