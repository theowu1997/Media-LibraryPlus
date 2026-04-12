import { useEffect } from "react";

interface UseKeyboardShortcutsOptions {
  onToggleGentle: () => void;
}

export function useKeyboardShortcuts({
  onToggleGentle,
}: UseKeyboardShortcutsOptions): void {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      // Ctrl+Shift+D → toggle Gentle mode on/off
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault();
        onToggleGentle();
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onToggleGentle]);
}
