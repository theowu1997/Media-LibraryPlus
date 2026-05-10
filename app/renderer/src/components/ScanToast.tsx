import type { ScanProgress } from "../../../shared/contracts";

interface ScanToastProps {
  scanProgress: ScanProgress;
  isScanning: boolean;
  progressPercent: number;
  scanStageLabel: string;
  activeFileName: string | null;
  scanElapsedLabel: string;
  scanEtaLabel: string;
  scanRateLabel: string;
  isScanStalled: boolean;
  onCancel: () => void;
  onDismiss: () => void;
}

export function ScanToast({
  scanProgress,
  isScanning,
  progressPercent,
  scanStageLabel,
  activeFileName,
  scanElapsedLabel,
  scanEtaLabel,
  scanRateLabel,
  isScanStalled,
  onCancel,
  onDismiss,
}: ScanToastProps) {
  return (
    <div className={`scan-toast${isScanning ? " active" : " done"}`}>
      <div className="scan-toast-top">
        <span className="scan-toast-label">
          {isScanning ? "⏳ Scanning…" : "✅ Scan complete"}
        </span>
        <div className="scan-toast-actions">
          {isScanning && (
            <button
              className="scan-toast-stop"
              onClick={onCancel}
              title="Stop scan (Esc)"
              type="button"
            >⏹</button>
          )}
          {!isScanning && (
            <button
              className="scan-toast-stop"
              onClick={onDismiss}
              title="Dismiss"
              type="button"
            >✕</button>
          )}
        </div>
      </div>
      <div className="scan-toast-bar-track">
        <progress
          className="scan-toast-bar-fill"
          max={100}
          value={progressPercent}
        />
      </div>
      <div className="scan-toast-info">
        <span className="scan-toast-pct">{progressPercent}%</span>
        <span className="scan-toast-count">
          {scanProgress.imported}/{scanProgress.totalFiles} movies
        </span>
        <span className="scan-toast-msg">{scanStageLabel}</span>
      </div>
      <div className="scan-toast-meta">
        <span>{scanElapsedLabel} elapsed</span>
        <span>{scanRateLabel}</span>
        <span>{scanEtaLabel}</span>
        <span className={isScanStalled ? "scan-health stalled" : "scan-health live"}>
          {isScanStalled ? "Waiting for file I/O" : "Live"}
        </span>
      </div>
      {activeFileName && <code className="scan-toast-file" title={scanProgress.currentFile ?? ""}>{activeFileName}</code>}
    </div>
  );
}
