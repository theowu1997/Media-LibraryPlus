import type { LibraryMode, OrganizationSettings, ScanAutomationOptions } from "../../../shared/contracts";

interface ScanOptionsDialogProps {
  pendingScanMode: LibraryMode;
  organizationDraft: OrganizationSettings;
  scanOptionsDraft: ScanAutomationOptions;
  onChangeScanOption: <K extends keyof ScanAutomationOptions>(key: K, value: ScanAutomationOptions[K]) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function ScanOptionsDialog({
  pendingScanMode,
  organizationDraft,
  scanOptionsDraft,
  onChangeScanOption,
  onConfirm,
  onClose,
}: ScanOptionsDialogProps) {
  const libraryPath =
    pendingScanMode === "normal"
      ? organizationDraft.normalLibraryPath
      : organizationDraft.gentleLibraryPath;

  return (
    <div className="modal-backdrop">
      <div className="modal-card scan-modal">
        <p className="eyebrow">Scan — {pendingScanMode} library</p>
        <h3>Set up your scan</h3>

        {/* ── SECTION 1: Library destination ── */}
        <div className="scan-section">
          <p className="scan-section-label">📁 Library folder (destination)</p>
          <div className="scan-library-path">
            {libraryPath || (
              <span className="muted-inline">
                Not set — files will stay in their original location
                <br />
                <small>Set a library path in Settings → Library storage</small>
              </span>
            )}
            {libraryPath && (
              <span className="path-chip">{libraryPath}</span>
            )}
          </div>
        </div>

        {/* ── SECTION 2: File handling ── */}
        <div className="scan-section">
          <p className="scan-section-label">📂 File handling</p>
          <p className="subtle" style={{ margin: "0.25rem 0 0" }}>
            Files stay exactly where they are. MLA+ only registers their location — nothing is moved or copied during a scan.
          </p>
        </div>

        {/* ── SECTION 3: Scan options ── */}
        <div className="scan-section">
          <p className="scan-section-label">⚙️ Scan options</p>
          <div className="options-grid">
            <label className="toggle-field">
              <input
                checked={scanOptionsDraft.importOnlyCompleteVideos}
                onChange={(e) => onChangeScanOption("importOnlyCompleteVideos", e.target.checked)}
                type="checkbox"
              />
              <span>Import only complete videos</span>
            </label>
            <label className="toggle-field">
              <input
                checked={scanOptionsDraft.importBetterQuality}
                onChange={(e) => onChangeScanOption("importBetterQuality", e.target.checked)}
                type="checkbox"
              />
              <span>Import better quality</span>
            </label>
            <label className="toggle-field">
              <input
                checked={scanOptionsDraft.autoResolveDuplicates}
                onChange={(e) => onChangeScanOption("autoResolveDuplicates", e.target.checked)}
                type="checkbox"
              />
              <span>Auto-resolve duplicates (keep best, delete rest)</span>
            </label>
            <label className="toggle-field">
              <input
                checked={scanOptionsDraft.scanAllSubfolders}
                onChange={(e) => onChangeScanOption("scanAllSubfolders", e.target.checked)}
                type="checkbox"
              />
              <span>Auto scan all sub folders</span>
            </label>
            <label className="toggle-field">
              <input
                checked={scanOptionsDraft.resolveLongPath}
                onChange={(e) => onChangeScanOption("resolveLongPath", e.target.checked)}
                type="checkbox"
              />
              <span>Resolve files long path</span>
            </label>
            <label className="toggle-field">
              <input
                checked={scanOptionsDraft.autoConvertToMp4}
                onChange={(e) => onChangeScanOption("autoConvertToMp4", e.target.checked)}
                type="checkbox"
              />
              <span>Auto convert to mp4</span>
            </label>
            <label className="toggle-field">
              <input
                checked={scanOptionsDraft.autoMatchSubtitle}
                onChange={(e) => onChangeScanOption("autoMatchSubtitle", e.target.checked)}
                type="checkbox"
              />
              <span>Auto matching subtitle</span>
            </label>
            <label className="toggle-field">
              <input
                checked={scanOptionsDraft.addToNormalModeLibrary}
                onChange={(e) =>
                  onChangeScanOption("addToNormalModeLibrary", e.target.checked)
                }
                type="checkbox"
              />
              <span>Add to Normal Mode library</span>
            </label>
            <label className="toggle-field">
              <input
                checked={scanOptionsDraft.addToGentleModeLibrary}
                onChange={(e) =>
                  onChangeScanOption("addToGentleModeLibrary", e.target.checked)
                }
                type="checkbox"
              />
              <span>Add to Gentle Mode library</span>
            </label>
          </div>
        </div>

        <div className="inline-actions">
          <button className="primary-button" onClick={onConfirm} type="button">
            Choose folder to scan
          </button>
          <button className="ghost-button" onClick={onClose} type="button">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
