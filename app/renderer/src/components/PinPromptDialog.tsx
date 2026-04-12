import type React from "react";

interface PinPromptDialogProps {
  pinInput: string;
  onPinChange: (value: string) => void;
  onUnlock: () => void;
  onClose: () => void;
}

export function PinPromptDialog({ pinInput, onPinChange, onUnlock, onClose }: PinPromptDialogProps) {
  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <p className="eyebrow">Hidden unlock</p>
        <h3>Open gentle mode for this session</h3>
        <input
          className="search-input"
          inputMode="numeric"
          maxLength={8}
          onChange={(event) => onPinChange(event.target.value)}
          placeholder="Enter PIN"
          type="password"
          value={pinInput}
        />
        <div className="inline-actions">
          <button
            className="primary-button"
            onClick={onUnlock}
            type="button"
          >
            Unlock
          </button>
          <button
            className="ghost-button"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
