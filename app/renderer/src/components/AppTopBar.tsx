import type { LibraryMode, ScanProgress } from "../../../shared/contracts";

interface InvalidFileEntry {
  path: string;
  reason: string;
  status: string;
}

interface AppTopBarProps {
  searchInput: string;
  onSearchChange: (value: string) => void;
  isScanning: boolean;
  onOpenScanOptions: (mode: LibraryMode) => void;
  onCancelScan: () => void;
  gentleUnlocked: boolean;
  scanProgress: ScanProgress | null;
  scanStageLabel: string;
  lastScanSummaryInvalidFiles: InvalidFileEntry[];
  getRejectedStatusLabel: (status: "incomplete" | "corrupt" | "invalid" | "unsupported") => string;
}

export function AppTopBar({
  searchInput,
  onSearchChange,
  isScanning,
  onOpenScanOptions,
  onCancelScan,
  gentleUnlocked,
  scanProgress,
  scanStageLabel,
  lastScanSummaryInvalidFiles,
  getRejectedStatusLabel: rejectedLabel,
}: AppTopBarProps) {
  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Local only</p>
          <h2>No external API server</h2>
        </div>
        <div className="topbar-actions">
          <input
            className="search-input"
            placeholder="Search titles, video IDs, filenames, keywords..."
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <button
            className="primary-button"
            disabled={isScanning}
            onClick={() => onOpenScanOptions("normal")}
            type="button"
          >
            {isScanning ? "Scanning..." : "Scan library"}
          </button>
          {isScanning ? (
            <button
              className="scan-stop-btn"
              onClick={onCancelScan}
              title="Stop the running scan (Esc)"
              type="button"
            >
              ⏹ Stop scan
            </button>
          ) : null}
          <span
            className={gentleUnlocked ? "monitor-status active" : "monitor-status"}
            title="Toggle Gentle mode with Ctrl+Alt+D"
          >
            Gentle {gentleUnlocked ? "on" : "off"} · Ctrl+Alt+D
          </span>
        </div>
      </header>

      {scanProgress && isScanning && (
        <section className="panel scan-inline-summary">
          <div className="scan-inline-row">
            <span className={isScanning ? "monitor-status active" : "monitor-status"}>{scanStageLabel}</span>
            <span>{scanProgress.imported} imported · {scanProgress.skipped} skipped · {scanProgress.totalFiles} total</span>
            {scanProgress.currentFile && <code className="scan-inline-file">{scanProgress.currentFile}</code>}
          </div>
        </section>
      )}

      {null}
    </>
  );
}
