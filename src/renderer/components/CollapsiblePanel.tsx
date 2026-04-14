import { useState, useEffect, useCallback, useRef, useImperativeHandle, forwardRef } from "react";

export interface CollapsiblePanelRef {
  /** Trigger refresh from parent (page-level refresh). Skips if collapsed. */
  refresh(): void;
  /** Whether this panel is currently collapsed */
  isCollapsed(): boolean;
}

interface Props {
  /** Unique key for persisting collapse state (e.g. "server:cpu") */
  storageKey: string;
  /** Panel title */
  title: string;
  /** Name prefix for SQL queries associated with this panel */
  sqlPrefix: string;
  /** Callback to open the SQL query browser filtered by name prefix */
  onShowSql?: (prefix: string) => void;
  /** Async data loader — called on mount and on refresh */
  loadData?: () => Promise<void>;
  /** Error message (if last load failed) */
  error?: string;
  /** Whether data is currently loading */
  loading?: boolean;
  children: React.ReactNode;
}

const STORAGE_PREFIX = "AJCannon:panel:";

export const CollapsiblePanel = forwardRef<CollapsiblePanelRef, Props>(function CollapsiblePanel(
  { storageKey, title, sqlPrefix, onShowSql, loadData, error, loading, children },
  ref,
) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_PREFIX + storageKey) === "1";
    } catch {
      return false;
    }
  });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_PREFIX + storageKey, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  }, [storageKey]);

  // Load data on mount if not collapsed
  useEffect(() => {
    if (!collapsed && loadData) {
      loadData();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    refresh() {
      if (!collapsed && loadData) {
        loadData();
      }
    },
    isCollapsed() {
      return collapsed;
    },
  }), [collapsed, loadData]);

  return (
    <div className={`cpanel${collapsed ? " cpanel-collapsed" : ""}${error ? " section-error" : ""}`}>
      <div className="cpanel-header" onClick={toggle}>
        <span className="cpanel-toggle">{collapsed ? "▸" : "▾"}</span>
        <strong className="cpanel-title">{title}</strong>
        {loading && <span className="cpanel-loading">⟳</span>}
        <div className="cpanel-actions" onClick={(e) => e.stopPropagation()}>
          {sqlPrefix && onShowSql && (
            <button
              className="btn-sm"
              onClick={() => onShowSql(sqlPrefix)}
              title={`Show SQL: ${sqlPrefix}`}
            >
              SQL
            </button>
          )}
        </div>
      </div>
      {!collapsed && (
        <div className="cpanel-body">
          {error ? (
            <div className="section-error-msg">⚠ {error}</div>
          ) : (
            children
          )}
        </div>
      )}
    </div>
  );
});
