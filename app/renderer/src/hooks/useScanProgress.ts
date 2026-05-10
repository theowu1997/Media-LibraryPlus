import { useEffect, useMemo, useRef, useState } from "react";
import type {
  DuplicateGroup,
  ScanMonitorTuning,
  ScanProgress,
  ScanSummary,
  SubtitleScanResult,
} from "../../../shared/contracts";
import {
  formatDurationCompact,
  getProgressPercent,
  getScanStageLabel,
} from "../utils";
import { normalizeScanMonitorTuning } from "../scanMonitorSettings";

const activeScanStages = new Set(["preparing", "discovering", "processing"]);

interface UseScanProgressOptions {
  desktopApi: typeof window.desktopApi | undefined;
  /** Called when the IPC scan listener determines a movie-list refresh is needed. */
  onScanRefresh: () => void;
  scanMonitorTuning: ScanMonitorTuning;
}

export function useScanProgress({
  desktopApi,
  onScanRefresh,
  scanMonitorTuning,
}: UseScanProgressOptions) {
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [lastScanSummary, setLastScanSummary] = useState<ScanSummary | null>(null);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [duplicateSelections, setDuplicateSelections] = useState<Record<string, string>>({});
  const [recentProcessedFiles, setRecentProcessedFiles] = useState<string[]>([]);
  const [subtitleScanRunning, setSubtitleScanRunning] = useState(false);
  const [subtitleScanResult, setSubtitleScanResult] = useState<SubtitleScanResult | null>(null);
  const [scanElapsedSeconds, setScanElapsedSeconds] = useState(0);
  const [scanEtaSeconds, setScanEtaSeconds] = useState<number | null>(null);
  const [scanFilesPerMinute, setScanFilesPerMinute] = useState(0);
  const [isScanStalled, setIsScanStalled] = useState(false);
  const [activeFileName, setActiveFileName] = useState<string | null>(null);

  const lastScanImportedRef = useRef(0);
  const scanRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onScanRefreshRef = useRef(onScanRefresh);
  const scanStartAtRef = useRef<number | null>(null);
  const lastAdvanceAtRef = useRef<number | null>(null);
  const lastProcessedRef = useRef(0);
  const lastRateSampleAtRef = useRef<number | null>(null);
  const rateEwmaRef = useRef(0);
  const monitorTuning = useMemo(
    () => normalizeScanMonitorTuning(scanMonitorTuning),
    [scanMonitorTuning]
  );

  const getDynamicStallThresholdMs = (filesPerMinute: number): number => {
    if (filesPerMinute <= 0) {
      return monitorTuning.stallBaseThresholdMs;
    }

    const secondsPerFile = 60 / filesPerMinute;
    const thresholdMs = Math.round(
      secondsPerFile * monitorTuning.stallRateMultiplier * 1000
    );
    return Math.max(
      monitorTuning.stallMinThresholdMs,
      Math.min(monitorTuning.stallMaxThresholdMs, thresholdMs)
    );
  };

  const estimateEtaSeconds = (
    totalFiles: number,
    processedFiles: number,
    ratePerSecond: number,
    elapsedSeconds: number
  ): number | null => {
    if (
      ratePerSecond <= 0.01 ||
      elapsedSeconds < monitorTuning.etaMinSeconds ||
      processedFiles < monitorTuning.etaMinProcessedFiles
    ) {
      return null;
    }

    const remaining = Math.max(0, totalFiles - processedFiles);
    return Math.round(remaining / ratePerSecond);
  };

  onScanRefreshRef.current = onScanRefresh;

  useEffect(() => {
    if (!desktopApi) return;

    const unsubscribe = window.desktopApi.onScanProgress((progress) => {
      const now = Date.now();

      if (scanDismissTimerRef.current) {
        clearTimeout(scanDismissTimerRef.current);
        scanDismissTimerRef.current = null;
      }

      setScanProgress(progress);

      if (!scanStartAtRef.current && activeScanStages.has(progress.stage)) {
        scanStartAtRef.current = now;
      }

      if (progress.stage === "preparing") {
        setRecentProcessedFiles([]);
        setLastScanSummary(null);
        lastScanImportedRef.current = 0;
        scanStartAtRef.current = now;
        lastAdvanceAtRef.current = now;
        lastProcessedRef.current = 0;
        lastRateSampleAtRef.current = now;
        rateEwmaRef.current = 0;
        setScanElapsedSeconds(0);
        setScanEtaSeconds(null);
        setScanFilesPerMinute(0);
        setIsScanStalled(false);
        setActiveFileName(null);
      }

      if (progress.currentFile) {
        const fileName = progress.currentFile.split(/[\\/]/).pop() ?? progress.currentFile;
        setActiveFileName(fileName);
        setRecentProcessedFiles((current) =>
          [
            progress.currentFile as string,
            ...current.filter((file) => file !== progress.currentFile),
          ].slice(0, 8)
        );
      }

      if (!progress.currentFile) {
        setActiveFileName(null);
      }

      if (activeScanStages.has(progress.stage)) {
        const processed = progress.processedFiles ?? 0;
        const previousProcessed = lastProcessedRef.current;
        const lastSampleAt = lastRateSampleAtRef.current ?? now;
        const elapsedSinceLastSample = Math.max(0.001, (now - lastSampleAt) / 1000);

        if (processed > previousProcessed) {
          const instantRate = (processed - previousProcessed) / elapsedSinceLastSample;
          rateEwmaRef.current =
            rateEwmaRef.current <= 0
              ? instantRate
              : rateEwmaRef.current * (1 - monitorTuning.rateEwmaAlpha) +
                instantRate * monitorTuning.rateEwmaAlpha;
          lastAdvanceAtRef.current = now;
        }

        lastProcessedRef.current = processed;
        lastRateSampleAtRef.current = now;

        const startedAt = scanStartAtRef.current ?? now;
        const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
        const rate = rateEwmaRef.current;
        const totalFiles = progress.totalFiles ?? 0;
        const etaSeconds = estimateEtaSeconds(totalFiles, processed, rate, elapsedSeconds);
        const filesPerMinute = Math.max(0, Math.round(rate * 60));
        const stallThresholdMs = getDynamicStallThresholdMs(filesPerMinute);
        const stalled =
          progress.stage === "processing" &&
          lastAdvanceAtRef.current !== null &&
          now - lastAdvanceAtRef.current > stallThresholdMs;

        setScanElapsedSeconds(elapsedSeconds);
        setScanFilesPerMinute(filesPerMinute);
        setScanEtaSeconds(etaSeconds);
        setIsScanStalled(stalled);
      }

      // Real-time refresh: throttled to every 3s while importing
      const newImported = progress.imported ?? 0;
      if (newImported > lastScanImportedRef.current) {
        lastScanImportedRef.current = newImported;
        if (scanRefreshTimerRef.current) clearTimeout(scanRefreshTimerRef.current);
        scanRefreshTimerRef.current = setTimeout(() => {
          onScanRefreshRef.current();
        }, 3000);
      }

      // Final refresh on scan end
      if (progress.stage === "completed" || progress.stage === "cancelled") {
        if (scanRefreshTimerRef.current) clearTimeout(scanRefreshTimerRef.current);
        onScanRefreshRef.current();
        setScanEtaSeconds(0);
        setIsScanStalled(false);
        scanDismissTimerRef.current = setTimeout(() => {
          setScanProgress(null);
          scanDismissTimerRef.current = null;
        }, 5000);
      }
    });

    return () => {
      if (scanRefreshTimerRef.current) {
        clearTimeout(scanRefreshTimerRef.current);
      }
      if (scanDismissTimerRef.current) {
        clearTimeout(scanDismissTimerRef.current);
      }
      unsubscribe();
    };
  }, [desktopApi, monitorTuning]);

  useEffect(() => {
    if (!scanProgress || !activeScanStages.has(scanProgress.stage)) {
      return;
    }

    const timer = setInterval(() => {
      const now = Date.now();
      const startedAt = scanStartAtRef.current;
      if (startedAt) {
        setScanElapsedSeconds(Math.max(0, Math.floor((now - startedAt) / 1000)));
      }

      const lastAdvanceAt = lastAdvanceAtRef.current;
      const dynamicStallThresholdMs = getDynamicStallThresholdMs(scanFilesPerMinute);
      const stalled =
        scanProgress.stage === "processing" &&
        Boolean(lastAdvanceAt && now - lastAdvanceAt > dynamicStallThresholdMs);
      setIsScanStalled(stalled);

      const rate = rateEwmaRef.current;
      const filesPerMinute = Math.max(0, Math.round(rate * 60));
      const elapsedSeconds = Math.max(
        0,
        Math.floor((now - (scanStartAtRef.current ?? now)) / 1000)
      );
      setScanEtaSeconds(
        estimateEtaSeconds(
          scanProgress.totalFiles ?? 0,
          scanProgress.processedFiles ?? 0,
          rate,
          elapsedSeconds
        )
      );
      setScanFilesPerMinute(filesPerMinute);
    }, 1000);

    return () => clearInterval(timer);
  }, [scanProgress, scanFilesPerMinute, monitorTuning]);

  const isScanning = Boolean(scanProgress && activeScanStages.has(scanProgress.stage));
  const progressPercent = getProgressPercent(scanProgress);
  const scanStageLabel = getScanStageLabel(scanProgress);
  const scanElapsedLabel = formatDurationCompact(scanElapsedSeconds);
  const scanEtaLabel =
    scanEtaSeconds === null
      ? "ETA --"
      : scanEtaSeconds <= 0
        ? "ETA 0s"
        : `ETA ${formatDurationCompact(scanEtaSeconds)}`;
  const scanRateLabel =
    scanFilesPerMinute <= 0 ? "Rate --" : `${scanFilesPerMinute} files/min`;

  return {
    scanProgress,
    setScanProgress,
    lastScanSummary,
    setLastScanSummary,
    duplicateGroups,
    setDuplicateGroups,
    duplicateSelections,
    setDuplicateSelections,
    recentProcessedFiles,
    subtitleScanRunning,
    setSubtitleScanRunning,
    subtitleScanResult,
    setSubtitleScanResult,
    activeFileName,
    scanElapsedLabel,
    scanEtaLabel,
    scanRateLabel,
    isScanStalled,
    isScanning,
    progressPercent,
    scanStageLabel,
  };
}
