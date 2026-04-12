import React from "react";
import type { AppPage, MovieRecord } from "../../../shared/contracts";

interface PageEntry {
  id: AppPage;
  label: string;
}

interface AppSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  width: number;
  onResizeStart: (e: React.MouseEvent) => void;
  pages: PageEntry[];
  activePage: AppPage;
  onNavigate: (page: AppPage) => void;
  movies: MovieRecord[];
  onShowPinPrompt: () => void;
  statusMessage: string;
}

export function AppSidebar({
  collapsed,
  onToggleCollapse,
  width,
  onResizeStart,
  pages,
  activePage,
  onNavigate,
  movies,
  onShowPinPrompt,
  statusMessage,
}: AppSidebarProps) {
  return (
    <>
      <aside
        className={collapsed ? "sidebar collapsed" : "sidebar"}
        style={collapsed ? undefined : { width }}
      >
        <button
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="sidebar-toggle"
          onClick={onToggleCollapse}
          type="button"
        >
          {collapsed ? "›" : "‹"}
        </button>
        <div className="sidebar-inner">
          <div>
            <p className="eyebrow">Electron Desktop</p>
            <h1>MLA+</h1>
            <p className="sidebar-copy">
              Local-first media management with Electron main process logic, React
              renderer pages, SQLite storage, and room for FFmpeg automation.
            </p>
          </div>

          <nav className="nav">
            {pages.map((page) => {
              const requiresLibrary = page.id === "library" || page.id === "search";
              const isDisabled = requiresLibrary && movies.length === 0;
              return (
                <button
                  key={page.id}
                  className={page.id === activePage ? "nav-link active" : "nav-link"}
                  onClick={() => { if (!isDisabled) onNavigate(page.id); }}
                  disabled={isDisabled}
                  title={isDisabled ? "Scan your library first to access this page" : undefined}
                  type="button"
                >
                  {page.label}
                </button>
              );
            })}
          </nav>

          <div className="sidebar-footer">
            <button
              className="ghost-button"
              onClick={onShowPinPrompt}
              type="button"
            >
              Gentle vault
            </button>
            <div className="hotkey-legend">
              <div className="hotkey-row"><kbd>F5</kbd><span>Scan saved folders</span></div>
              <div className="hotkey-row"><kbd>Ctrl+⇧+N</kbd><span>Scan new Normal</span></div>
              <div className="hotkey-row"><kbd>Ctrl+⇧+G</kbd><span>Scan new Gentle</span></div>
              <div className="hotkey-row"><kbd>1–6</kbd><span>Switch page</span></div>
              <div className="hotkey-row"><kbd>Esc</kbd><span>Close panel</span></div>
              <div className="hotkey-row hotkey-section"><span>Player (VLC keys)</span></div>
              <div className="hotkey-row"><kbd>Space</kbd><span>Play / Pause</span></div>
              <div className="hotkey-row"><kbd>S</kbd><span>Stop</span></div>
              <div className="hotkey-row"><kbd>← →</kbd><span>Seek ±10s</span></div>
              <div className="hotkey-row"><kbd>⇧ ← →</kbd><span>Seek ±3s</span></div>
              <div className="hotkey-row"><kbd>Ctrl ← →</kbd><span>Seek ±60s</span></div>
              <div className="hotkey-row"><kbd>↑ ↓</kbd><span>Volume ±5%</span></div>
              <div className="hotkey-row"><kbd>M</kbd><span>Mute</span></div>
              <div className="hotkey-row"><kbd>[ ]</kbd><span>Speed ±0.25×</span></div>
              <div className="hotkey-row"><kbd>=</kbd><span>Normal speed</span></div>
              <div className="hotkey-row"><kbd>F / F11</kbd><span>Fullscreen</span></div>
              <div className="hotkey-row"><kbd>E</kbd><span>Next frame</span></div>
              <div className="hotkey-row"><kbd>N / P</kbd><span>Next / Prev movie</span></div>
            </div>
            <p className="status-note">{statusMessage}</p>
          </div>
        </div>
      </aside>

      <div
        className={`sidebar-resize-handle${collapsed ? " hidden" : ""}`}
        onMouseDown={onResizeStart}
        title="Drag to resize sidebar"
      />
    </>
  );
}
