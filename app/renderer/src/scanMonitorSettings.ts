import {
  DEFAULT_SCAN_MONITOR_TUNING,
  type ScanMonitorTuning,
} from "../../shared/contracts";

const STORAGE_KEY = "mla.scanMonitorTuning.v1";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeScanMonitorTuning(
  input: Partial<ScanMonitorTuning> | null | undefined
): ScanMonitorTuning {
  const source = input ?? {};

  return {
    rateEwmaAlpha: clamp(
      Number(source.rateEwmaAlpha ?? DEFAULT_SCAN_MONITOR_TUNING.rateEwmaAlpha),
      0.05,
      0.5
    ),
    etaMinSeconds: clamp(
      Math.round(Number(source.etaMinSeconds ?? DEFAULT_SCAN_MONITOR_TUNING.etaMinSeconds)),
      0,
      45
    ),
    etaMinProcessedFiles: clamp(
      Math.round(
        Number(
          source.etaMinProcessedFiles ??
            DEFAULT_SCAN_MONITOR_TUNING.etaMinProcessedFiles
        )
      ),
      1,
      50
    ),
    stallBaseThresholdMs: clamp(
      Math.round(
        Number(
          source.stallBaseThresholdMs ??
            DEFAULT_SCAN_MONITOR_TUNING.stallBaseThresholdMs
        )
      ),
      5000,
      60000
    ),
    stallMinThresholdMs: clamp(
      Math.round(
        Number(
          source.stallMinThresholdMs ??
            DEFAULT_SCAN_MONITOR_TUNING.stallMinThresholdMs
        )
      ),
      5000,
      60000
    ),
    stallMaxThresholdMs: clamp(
      Math.round(
        Number(
          source.stallMaxThresholdMs ??
            DEFAULT_SCAN_MONITOR_TUNING.stallMaxThresholdMs
        )
      ),
      5000,
      90000
    ),
    stallRateMultiplier: clamp(
      Number(
        source.stallRateMultiplier ?? DEFAULT_SCAN_MONITOR_TUNING.stallRateMultiplier
      ),
      1,
      8
    ),
  };
}

export function loadScanMonitorTuning(): ScanMonitorTuning {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SCAN_MONITOR_TUNING;
    }

    const parsed = JSON.parse(raw) as Partial<ScanMonitorTuning>;
    return normalizeScanMonitorTuning(parsed);
  } catch {
    return DEFAULT_SCAN_MONITOR_TUNING;
  }
}

export function saveScanMonitorTuning(settings: ScanMonitorTuning): void {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(normalizeScanMonitorTuning(settings))
    );
  } catch {
    // Ignore storage failures and keep runtime settings.
  }
}

export function resetScanMonitorTuning(): ScanMonitorTuning {
  const defaults = { ...DEFAULT_SCAN_MONITOR_TUNING };
  saveScanMonitorTuning(defaults);
  return defaults;
}
