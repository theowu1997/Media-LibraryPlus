import { useEffect, useRef, useState } from "react";
import type { MoveProgress } from "../../../shared/contracts";

const activeMoveStages = new Set([
  "starting",
  "moving",
  "subtitles",
  "nfo",
  "database",
  "cleanup",
  "rollback",
]);

interface UseMoveProgressOptions {
  desktopApi: typeof window.desktopApi | undefined;
}

export function useMoveProgress({ desktopApi }: UseMoveProgressOptions) {
  const [moveProgress, setMoveProgress] = useState<MoveProgress | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!desktopApi) return;

    const unsubscribe = window.desktopApi.onMoveProgress((progress) => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }

      setMoveProgress(progress);

      if (progress.stage === "completed" || progress.stage === "error") {
        dismissTimerRef.current = setTimeout(() => {
          setMoveProgress(null);
          dismissTimerRef.current = null;
        }, 5000);
      }
    });

    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
      unsubscribe();
    };
  }, [desktopApi]);

  const isMoving = Boolean(moveProgress && activeMoveStages.has(moveProgress.stage));
  const total = moveProgress?.totalMovies ?? 0;
  const completed = moveProgress?.completedMovies ?? 0;
  const progressPercent =
    total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : isMoving ? 5 : 0;

  return {
    moveProgress,
    setMoveProgress,
    isMoving,
    progressPercent,
  };
}

