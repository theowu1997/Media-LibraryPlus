import type { DuplicateGroup } from "../../../shared/contracts";

interface DuplicateResolutionModalProps {
  duplicateGroups: DuplicateGroup[];
  duplicateSelections: Record<string, string>;
  onSelectFile: (groupKey: string, filePath: string) => void;
  onResolveGroup: (groupKey: string) => void | Promise<void>;
  onResolveAll: () => void | Promise<void>;
  onSkipAll: () => void;
}

const getUniqueFiles = (files: DuplicateGroup['files']) => {
  const seen = new Set<string>();
  return files.filter((f: DuplicateGroup['files'][number]) => {
    if (seen.has(f.path)) return false;
    seen.add(f.path);
    return true;
  });
};

const pluralize = (count: number, word: string) => count !== 1 ? `${word}s` : word;

const getFileName = (path: string) => path.split(/[\\/]/).pop() || path;

const formatFileSize = (bytes: number) => (bytes / 1024 / 1024).toFixed(0);

export function DuplicateResolutionModal({
  duplicateGroups,
  duplicateSelections,
  onSelectFile,
  onResolveGroup,
  onResolveAll,
  onSkipAll,
}: DuplicateResolutionModalProps) {
  return (
    <div className="modal-backdrop dup-modal-overlay modal-shell-backdrop-enter">
      <div className="modal-card modal-card--dialog dup-modal modal-shell-surface-enter">
        <div className="dup-modal-header">
          <div>
            <p className="eyebrow">Duplicates found</p>
            <h3>
              {duplicateGroups.length} {pluralize(duplicateGroups.length, "group")} need your decision
            </h3>
            <p className="subtle">
              Review each duplicate set, keep the best file, and let MLA+ remove the rest.
            </p>
          </div>
          <button className="ghost-button" onClick={onSkipAll} type="button">
            ✕ Skip all
          </button>
        </div>

        <div className="dup-modal-body">
          {duplicateGroups.map((group) => {
            const uniqueFiles = getUniqueFiles(group.files);
            const defaultSelection = uniqueFiles[0]?.path || group.files[0].path;
            const selected = duplicateSelections[group.key] ?? defaultSelection;

            return (
              <div className="dup-group" key={group.key}>
                <div className="dup-group-title">
                  {group.videoId && <span className="mode-pill">{group.videoId}</span>}
                  <strong>{group.title}</strong>
                </div>
                <div className="dup-files">
                  {uniqueFiles.map((file) => {
                    const isSelected = selected === file.path;
                    return (
                      <button
                        key={file.path}
                        className={`dup-file${isSelected ? " selected" : ""}`}
                        onClick={() => onSelectFile(group.key, file.path)}
                        type="button"
                      >
                        <div className="dup-file-check">{isSelected ? "●" : "○"}</div>
                        <div className="dup-file-info">
                          <span className="dup-file-name">{getFileName(file.path)}</span>
                          <span className="dup-file-meta">
                            {file.resolution} · {formatFileSize(file.fileSize)} MB
                            {file.autoSelected && (
                              <span className="dup-badge">auto-picked</span>
                            )}
                          </span>
                          <span className="dup-file-path">{file.path}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <button
                  className="dup-resolve-btn"
                  onClick={() => onResolveGroup(group.key)}
                  type="button"
                >
                  ✓ Keep selected · delete {group.files.length - 1} {pluralize(group.files.length - 1, "other")}
                </button>
              </div>
            );
          })}
        </div>

        {duplicateGroups.length > 1 && (
          <div className="dup-modal-footer">
            <button className="primary-button" onClick={onResolveAll} type="button">
              ✓ Resolve all {duplicateGroups.length} groups
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
