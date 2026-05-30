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

      const key = e.key.toLowerCase();
      const toggleByShift = e.ctrlKey && e.shiftKey && key === "d";
      const toggleByAlt = e.ctrlKey && e.altKey && key === "d";

      // Ctrl+Shift+D or Ctrl+Alt+D → toggle Gentle mode on/off
      if (toggleByShift || toggleByAlt) {
        e.preventDefault();
        onToggleGentle();
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onToggleGentle]);
}
