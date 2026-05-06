import { useEffect, useRef, useState } from "react";

const CLOSE_ANIMATION_DURATION = 160;

interface PinPromptDialogProps {
  pinInput: string;
  onPinChange: (value: string) => void;
  onUnlock: () => void;
  onClose: () => void;
}

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

export function PinPromptDialog({ pinInput, onPinChange, onUnlock, onClose }: PinPromptDialogProps) {
  const { isClosing, runWithExitAnimation } = useExitAnimation();

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

  const backdropClass = isClosing ? "modal-shell-backdrop-exit" : "modal-shell-backdrop-enter";
  const dialogClass = isClosing ? "modal-shell-surface-exit" : "modal-shell-surface-enter";

  return (
    <div
      className={`modal-backdrop ${backdropClass}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          runWithExitAnimation(onClose);
        }
      }}
    >
      <div className={`modal-card modal-card--dialog ${dialogClass}`}>
        <div className="modal-dialog-header">
          <p className="eyebrow">Gentle mode</p>
          <h3>Enter your PIN</h3>
          <p className="subtle">Unlock the Gentle library to continue browsing and playing protected titles.</p>
        </div>
        <input
          className="search-input"
          inputMode="numeric"
          maxLength={4}
          onChange={(event) => onPinChange(event.target.value)}
          placeholder="Enter PIN"
          type="password"
          value={pinInput}
        />
        <div className="inline-actions modal-dialog-footer">
          <span className="modal-dialog-caption">PIN must be 4 digits.</span>
          <button
            className="primary-button"
            onClick={onUnlock}
            type="button"
            disabled={pinInput.length !== 4}
          >
            Unlock
          </button>
          <button
            className="ghost-button"
            onClick={() => runWithExitAnimation(onClose)}
            type="button"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
