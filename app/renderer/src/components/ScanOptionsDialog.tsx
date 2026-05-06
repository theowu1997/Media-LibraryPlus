import { useEffect, useRef, useState } from "react";
import styles from "./ScanOptionsDialog.module.css";
import type { LibraryMode, OrganizationSettings, ScanAutomationOptions } from "../../../shared/contracts";

const CLOSE_ANIMATION_DURATION = 160;

const OPTION_GROUPS: Array<{
  title: string;
  hint: string;
  options: Array<{
    key: keyof ScanAutomationOptions;
    label: string;
    description: string;
    badge?: string;
    disabled?: boolean;
  }>;
}> = [
  {
    title: "Import speed and coverage",
    hint: "Control how aggressively the scan looks for metadata and files.",
    options: [
      {
        key: "fastScan",
        label: "Fast Scan",
        description: "Skip web metadata, poster fetches, and SubtitleCat downloads for the quickest import.",
        badge: "Speed"
      },
      {
        key: "scanAllSubfolders",
        label: "Scan all subfolders",
        description: "Walk the full folder tree instead of limiting the scan to the top level.",
        badge: "Coverage"
      },
      {
        key: "importOnlyCompleteVideos",
        label: "Only import long videos",
        description: "Filter out shorter files and keep items that are at least 20 minutes long.",
        badge: "Filter"
      }
    ]
  },
  {
    title: "Quality and file handling",
    hint: "Decide how duplicates, file format cleanup, and path repair should behave.",
    options: [
      {
        key: "importBetterQuality",
        label: "Prefer better quality",
        description: "Keep the higher-quality version when multiple candidates match the same title.",
        badge: "Quality"
      },
      {
        key: "autoResolveDuplicates",
        label: "Auto-resolve duplicates",
        description: "Automatically keep the best file and suppress the duplicate review step.",
        badge: "Automation"
      },
      {
        key: "resolveLongPath",
        label: "Resolve long file paths",
        description: "Attempt to shorten or normalize Windows paths before import fails.",
        badge: "Windows"
      },
      {
        key: "autoConvertToMp4",
        label: "Auto-convert to MP4",
        description: "Normalize compatible files into MP4 during import when conversion is helpful.",
        badge: "Conversion"
      }
    ]
  },
  {
    title: "Subtitles",
    hint: "Match existing subtitle files first, then optionally reach out to SubtitleCat.",
    options: [
      {
        key: "autoMatchSubtitle",
        label: "Auto-match local subtitles",
        description: "Link nearby subtitle files that already exist in the scanned folder structure.",
        badge: "Local"
      },
      {
        key: "autoDownloadSubtitleFromSubtitleCat",
        label: "Download from SubtitleCat",
        description: "Fetch subtitles only when no local subtitle file can be matched.",
        badge: "Online"
      }
    ]
  }
];

const TARGET_LIBRARY_OPTIONS: Array<{
  key: "addToNormalModeLibrary" | "addToGentleModeLibrary";
  label: string;
  description: string;
}> = [
  {
    key: "addToNormalModeLibrary",
    label: "Add to Normal Mode",
    description: "Import into the Normal library view even if the source came from another mode."
  },
  {
    key: "addToGentleModeLibrary",
    label: "Add to Gentle Mode",
    description: "Route imported titles into the Gentle library for a softer browse profile."
  }
];

const SUBTITLE_LANGUAGES = [
  { value: "zh-hans", label: "Chinese Simplified" },
  { value: "zh-hant", label: "Chinese Traditional" },
  { value: "zh", label: "Chinese" },
  { value: "en", label: "English" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "fr", label: "French" },
  { value: "es", label: "Spanish" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "th", label: "Thai" },
  { value: "vi", label: "Vietnamese" },
  { value: "id", label: "Indonesian" },
  { value: "ar", label: "Arabic" },
  { value: "ru", label: "Russian" },
  { value: "it", label: "Italian" }
];

function useExitAnimation() {
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const runWithExitAnimation = (action: () => void) => {
    if (isClosing) return;
    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(action, CLOSE_ANIMATION_DURATION);
  };

  return { isClosing, runWithExitAnimation };
}

interface ScanOptionsDialogProps {
  pendingScanMode: LibraryMode;
  organizationDraft: OrganizationSettings;
  scanOptionsDraft: ScanAutomationOptions;
  scanSourceMode: "saved" | "folder";
  onChangeScanOption: <K extends keyof ScanAutomationOptions>(key: K, value: ScanAutomationOptions[K]) => void;
  onChangeScanSource: (mode: "saved" | "folder") => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function ScanOptionsDialog({
  pendingScanMode,
  organizationDraft,
  scanOptionsDraft,
  scanSourceMode,
  onChangeScanOption,
  onChangeScanSource,
  onConfirm,
  onClose,
}: ScanOptionsDialogProps) {
  const { isClosing, runWithExitAnimation } = useExitAnimation();

  const libraryPath = pendingScanMode === "normal"
    ? organizationDraft.normalLibraryPath
    : organizationDraft.gentleLibraryPath;

  const autoSubtitleDisabled = scanOptionsDraft.fastScan;
  const targetLibraryLabel = scanOptionsDraft.addToNormalModeLibrary
    ? "Normal Mode"
    : scanOptionsDraft.addToGentleModeLibrary
      ? "Gentle Mode"
      : "Keep current mode";

  const modeLabel = pendingScanMode === "normal" ? "Normal mode" : "Gentle mode";
  const sourceBadgeLabel = scanSourceMode === "saved" ? "Saved folders" : "New folder";
  const sourceLabel = scanSourceMode === "saved" ? "Saved library folders" : "Pick a new folder";
  const sourceHint = scanSourceMode === "saved"
    ? "Rescans your configured roots with the current import rules."
    : "Starts a one-off import from a folder you choose now.";

  const backdropClass = isClosing ? "modal-shell-backdrop-exit" : "modal-shell-backdrop-enter";
  const dialogClass = isClosing ? "modal-shell-surface-exit" : "modal-shell-surface-enter";

  const optionGroupsWithBadges = OPTION_GROUPS.map((group) => {
    if (group.options[group.options.length - 1]?.key === "autoDownloadSubtitleFromSubtitleCat") {
      return {
        ...group,
        options: group.options.map((opt) => ({
          ...opt,
          badge: opt.key === "autoDownloadSubtitleFromSubtitleCat"
            ? (autoSubtitleDisabled ? "Disabled by Fast Scan" : "Online")
            : opt.badge,
          disabled: opt.key === "autoDownloadSubtitleFromSubtitleCat" ? autoSubtitleDisabled : opt.disabled
        }))
      };
    }
    return group;
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        runWithExitAnimation(onClose);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isClosing, onClose, runWithExitAnimation]);

  return (
    <div
      className={`modal-backdrop ${backdropClass}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          runWithExitAnimation(onClose);
        }
      }}
    >
      <div className={`modal-card scan-modal ${styles.scanModal} ${dialogClass}`}>
        <div className={`scan-modal-header ${styles.headerGrid}`}>
          <div>
            <p className="eyebrow">Scan</p>
            <h3>{modeLabel} setup</h3>
            <p className="subtle">
              Choose a source, review the destination, then confirm the scan options before import starts.
            </p>
          </div>
          <div className="scan-modal-badges">
            <span>{sourceBadgeLabel}</span>
            <span>{pendingScanMode === "normal" ? "Normal" : "Gentle"}</span>
          </div>
          <div className={styles.heroSummary}>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Source</span>
              <strong className={styles.summaryValue}>{sourceLabel}</strong>
              <span className={styles.summaryHint}>{sourceHint}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Destination</span>
              <strong className={styles.summaryValue}>{libraryPath ? "Library path ready" : "Path not configured"}</strong>
              <span className={styles.summaryHint}>{libraryPath || "Files stay under the scan root unless organization settings move them."}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Library target</span>
              <strong className={styles.summaryValue}>{targetLibraryLabel}</strong>
              <span className={styles.summaryHint}>Choose which library mode should receive imported titles.</span>
            </div>
          </div>
        </div>

        <div className={styles.sectionStack}>
          <div className="scan-section">
            <p className="scan-section-label">🧭 Scan source</p>
            <p className={styles.sectionHint}>Pick where the scan should start before the import rules below are applied.</p>
            <div className={styles.sourceGrid}>
              <label className={`${styles.sourceCard} ${scanSourceMode === "saved" ? styles.sourceCardActive : ""}`}>
                <div className={styles.sourceHeader}>
                  <input
                    checked={scanSourceMode === "saved"}
                    onChange={() => onChangeScanSource("saved")}
                    type="radio"
                    name="scan-source"
                  />
                  <span>
                    <strong className={styles.sourceTitle}>Scan saved library folders</strong>
                    <span className={styles.sourceHint}>Use the folders already configured in Settings and run the current import rules across them again.</span>
                  </span>
                </div>
              </label>
              <label className={`${styles.sourceCard} ${scanSourceMode === "folder" ? styles.sourceCardActive : ""}`}>
                <div className={styles.sourceHeader}>
                  <input
                    checked={scanSourceMode === "folder"}
                    onChange={() => onChangeScanSource("folder")}
                    type="radio"
                    name="scan-source"
                  />
                  <span>
                    <strong className={styles.sourceTitle}>Choose a new folder</strong>
                    <span className={styles.sourceHint}>Start from a one-off source folder while keeping the same library organization and import automation.</span>
                  </span>
                </div>
              </label>
            </div>
          </div>

          <div className="scan-section">
            <p className="scan-section-label">Library folder destination</p>
            <div className={styles.destinationCard}>
              <div className={styles.destinationMeta}>
                <strong className={styles.sourceTitle}>{modeLabel} library destination</strong>
                <span className={`${styles.destinationState} ${libraryPath ? styles.destinationReady : styles.destinationWarning}`}>
                  {libraryPath ? "Configured" : "Needs attention"}
                </span>
              </div>
              <div className="scan-library-path">
                {libraryPath ? (
                  <span className="path-chip">{libraryPath}</span>
                ) : (
                  <span className="muted-inline">
                    Not set. Imported files stay under the scanned root unless organization options move them.
                    <br />
                    <small>Set a library path in Settings {">"} Library storage</small>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="scan-section">
            <p className="scan-section-label">File handling</p>
            <div className={styles.warningNote}>
              <strong className={styles.sourceTitle}>What happens during import</strong>
              <p className={`subtle ${styles.zeroMargin}`}>
                {scanSourceMode === "saved"
                  ? "Saved folders are rescanned using the current import options. Files may still be reorganized when move, rename, long-path, or conversion options apply."
                  : "Choosing a new folder starts an import from that folder. Files may still be reorganized when move, rename, long-path, or conversion options apply."}
              </p>
            </div>
          </div>

          <div className="scan-section">
            <p className="scan-section-label">⚙️ Scan options</p>
            <p className={`subtle ${styles.sectionIntro}`}>
              Fast Scan skips web metadata, poster fetches, and SubtitleCat downloads so imports finish sooner.
            </p>
            <div className={styles.sectionStack}>
              {optionGroupsWithBadges.map((group) => (
                <div className={styles.groupCard} key={group.title}>
                  <div className={styles.groupHeader}>
                    <h4 className={styles.groupTitle}>{group.title}</h4>
                    <p className={styles.groupHint}>{group.hint}</p>
                  </div>
                  <div className={styles.optionGrid}>
                    {group.options.map((option) => {
                      const checked = Boolean(scanOptionsDraft[option.key]);
                      return (
                        <label
                          className={`${styles.optionCard} ${checked ? styles.optionCardChecked : ""} ${option.disabled ? styles.optionCardDisabled : ""}`}
                          key={String(option.key)}
                        >
                          <div className={styles.optionHeader}>
                            <input
                              checked={checked}
                              disabled={option.disabled}
                              onChange={(event) => onChangeScanOption(option.key, event.target.checked as ScanAutomationOptions[typeof option.key])}
                              type="checkbox"
                            />
                            <span>
                              <strong className={styles.optionTitle}>{option.label}</strong>
                              <span className={styles.optionHint}>{option.description}</span>
                            </span>
                          </div>
                          {option.badge ? <span className={styles.optionMeta}>{option.badge}</span> : null}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className={styles.groupCard}>
                <div className={styles.groupHeader}>
                  <h4 className={styles.groupTitle}>Subtitle language preference</h4>
                  <p className={styles.groupHint}>Choose which SubtitleCat language should be preferred when downloads are enabled.</p>
                </div>
                <div className={styles.selectCard}>
                  <label className={styles.selectLabel}>
                    <span>Preferred SubtitleCat language</span>
                    <select
                      className={styles.selectControl}
                      value={scanOptionsDraft.preferredSubtitleLanguage}
                      onChange={(e) =>
                        onChangeScanOption("preferredSubtitleLanguage", e.target.value as ScanAutomationOptions["preferredSubtitleLanguage"])
                      }
                      disabled={!scanOptionsDraft.autoDownloadSubtitleFromSubtitleCat || scanOptionsDraft.fastScan}
                    >
                      {SUBTITLE_LANGUAGES.map((lang) => (
                        <option key={lang.value} value={lang.value}>{lang.label}</option>
                      ))}
                    </select>
                  </label>
                  {autoSubtitleDisabled ? (
                    <div className={styles.warningNote}>
                      <strong className={styles.sourceTitle}>Subtitle downloads are paused</strong>
                      <p className={`subtle ${styles.zeroMargin}`}>
                        Turn off Fast Scan to re-enable SubtitleCat downloads and language preference.
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className={styles.groupCard}>
                <div className={styles.groupHeader}>
                  <h4 className={styles.groupTitle}>Library target</h4>
                  <p className={styles.groupHint}>Choose which library mode should receive the imported results.</p>
                </div>
                <div className={styles.targetGrid}>
                  {TARGET_LIBRARY_OPTIONS.map((option) => {
                    const checked = scanOptionsDraft[option.key];
                    return (
                      <label className={`${styles.optionCard} ${checked ? styles.optionCardChecked : ""}`} key={option.key}>
                        <div className={styles.optionHeader}>
                          <input
                            checked={checked}
                            onChange={(event) => onChangeScanOption(option.key, event.target.checked)}
                            type="checkbox"
                          />
                          <span>
                            <strong className={styles.optionTitle}>{option.label}</strong>
                            <span className={styles.optionHint}>{option.description}</span>
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={`inline-actions scan-modal-actions ${styles.actionRow}`}>
          <span className={styles.actionMeta}>Review the source and import rules, then start the scan when ready.</span>
          <button className="primary-button" onClick={() => runWithExitAnimation(onConfirm)} type="button">
            {scanSourceMode === "saved" ? "Rescan saved folders" : "Scan chosen folder"}
          </button>
          <button className="ghost-button" onClick={() => runWithExitAnimation(onClose)} type="button">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
