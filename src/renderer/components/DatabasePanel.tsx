import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import hljs from "highlight.js/lib/core";
import sql from "highlight.js/lib/languages/sql";
import { bridge } from "../bridge";
import type { DatabaseDetailInfo, ExtendedProperty, DdlHistoryEvent, CmdResult } from "../../shared/types";

hljs.registerLanguage("sql", sql);

interface Props {
  server: string;
  database: string;
}

const OBJECT_TYPE_FILTERS: Record<string, string[]> = {
  "Tables": ["CREATE_TABLE", "ALTER_TABLE", "DROP_TABLE"],
  "Procedures": ["CREATE_PROCEDURE", "ALTER_PROCEDURE", "DROP_PROCEDURE"],
  "Functions": ["CREATE_FUNCTION", "ALTER_FUNCTION", "DROP_FUNCTION"],
  "Types": ["CREATE_TYPE", "DROP_TYPE"],
  "Schemas": ["CREATE_SCHEMA", "ALTER_SCHEMA", "DROP_SCHEMA"],
};

export function DatabasePanel({ server, database }: Props) {
  const [info, setInfo] = useState<DatabaseDetailInfo | null>(null);
  const [extProps, setExtProps] = useState<ExtendedProperty[]>([]);
  const [ddlHistory, setDdlHistory] = useState<DdlHistoryEvent[]>([]);
  const [loading, setLoading] = useState(false);

  /* Quick actions modals */
  const [modal, setModal] = useState<"grant" | "createUser" | "createRole" | null>(null);
  const [field1, setField1] = useState("");
  const [field2, setField2] = useState("");
  const [actionResult, setActionResult] = useState<CmdResult | null>(null);
  const [busy, setBusy] = useState(false);

  /* DDL filters */
  const [ddlSearch, setDdlSearch] = useState("");
  const [ddlEventTypes, setDdlEventTypes] = useState<Set<string>>(new Set());
  const [ddlObjectTypes, setDdlObjectTypes] = useState<Set<string>>(new Set());
  const [expandedDdl, setExpandedDdl] = useState<Set<number>>(new Set());
  const [quickFilter, setQuickFilter] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [d, ep, ddl] = await Promise.all([
      bridge.getDatabaseDetail(server, database).catch(() => null),
      bridge.getDatabaseExtProps(server, database).catch(() => []),
      bridge.getDatabaseDdlHistory(server, database).catch(() => []),
    ]);
    setInfo(d);
    setExtProps(ep);
    setDdlHistory(ddl);
    setLoading(false);
  }, [server, database]);

  useEffect(() => { refresh(); }, [refresh]);

  /* All unique event types and object types for filter options */
  const allEventTypes = useMemo(() => Array.from(new Set(ddlHistory.map(e => e.event_type))).sort(), [ddlHistory]);
  const allObjectTypes = useMemo(() => Array.from(new Set(ddlHistory.map(e => e.object_type).filter(Boolean))).sort(), [ddlHistory]);

  /* Filtered DDL history */
  const filteredDdl = useMemo(() => {
    let result = ddlHistory;

    // Quick filter
    if (quickFilter && OBJECT_TYPE_FILTERS[quickFilter]) {
      const types = OBJECT_TYPE_FILTERS[quickFilter];
      result = result.filter(e => types.includes(e.event_type));
    }

    // Event type filter
    if (ddlEventTypes.size > 0) {
      result = result.filter(e => ddlEventTypes.has(e.event_type));
    }

    // Object type filter
    if (ddlObjectTypes.size > 0) {
      result = result.filter(e => ddlObjectTypes.has(e.object_type));
    }

    // Text search
    if (ddlSearch) {
      const lc = ddlSearch.toLowerCase();
      result = result.filter(e =>
        e.event_type.toLowerCase().includes(lc) ||
        e.login_name.toLowerCase().includes(lc) ||
        e.object_name.toLowerCase().includes(lc) ||
        e.schema_name.toLowerCase().includes(lc) ||
        e.object_type.toLowerCase().includes(lc) ||
        (e.target_object_name ?? "").toLowerCase().includes(lc) ||
        (e.tsql_command ?? "").toLowerCase().includes(lc)
      );
    }

    return result;
  }, [ddlHistory, ddlSearch, ddlEventTypes, ddlObjectTypes, quickFilter]);

  function toggleDdlExpand(i: number) {
    setExpandedDdl(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  function toggleEventType(t: string) {
    setDdlEventTypes(prev => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  }

  function toggleObjectType(t: string) {
    setDdlObjectTypes(prev => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  }

  /* Quick actions */
  function openModal(type: "grant" | "createUser" | "createRole") {
    setModal(type);
    setField1("");
    setField2("");
    setActionResult(null);
  }

  async function executeAction() {
    setBusy(true);
    setActionResult(null);
    try {
      let res: CmdResult;
      if (modal === "grant") {
        res = await bridge.grantPermission(server, field1, field2);
      } else if (modal === "createUser") {
        res = { success: false, message: "Not implemented yet" };
      } else {
        res = { success: false, message: "Not implemented yet" };
      }
      setActionResult(res);
    } catch (e: unknown) {
      setActionResult({ success: false, message: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  function fmtMB(v: number | null): string {
    if (v == null) return "—";
    if (v >= 1024) return `${(v / 1024).toFixed(2)} GB`;
    return `${v.toFixed(1)} MB`;
  }

  return (
    <div className="page-panel">
      <div className="page-header">
        <h3>Database — {database}</h3>
        <button onClick={refresh} disabled={loading}>{loading ? "..." : "Refresh"}</button>
      </div>

      {/* Quick Actions */}
      <div className="cpanel">
        <div className="cpanel-body" style={{ display: "flex", gap: 8, padding: "8px 10px", alignItems: "center" }}>
          <button onClick={() => openModal("grant")}>Grant</button>
          <span style={{ color: "var(--fg-dim)" }}>Create:</span>
          <button onClick={() => openModal("createUser")}>Create User</button>
          <button onClick={() => openModal("createRole")}>Create Role</button>
        </div>
      </div>

      {/* General Info */}
      {info && (
        <div className="cpanel">
          <div className="cpanel-header"><span className="cpanel-title">General Info</span></div>
          <div className="cpanel-body">
            <div className="server-metrics">
              <div className="server-metric">
                <div className="server-metric-value">{fmtMB(info.totalSizeMB)}</div>
                <div className="server-metric-label">Total Size</div>
              </div>
              <div className="server-metric">
                <div className="server-metric-value">{info.lastBackupDate ?? "Never"}</div>
                <div className="server-metric-label">Last Full Backup</div>
              </div>
              <div className="server-metric">
                <div className="server-metric-value">{info.tableCount} / {info.sqlModuleCount}</div>
                <div className="server-metric-label">Tables / SQL Modules</div>
              </div>
              <div className="server-metric">
                <div className="server-metric-value">{info.filegroupCount} / {info.fileCount}</div>
                <div className="server-metric-label">Filegroups / Files</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Extended Properties */}
      {extProps.length > 0 && (
        <div className="cpanel">
          <div className="cpanel-header"><span className="cpanel-title">Extended Properties ({extProps.length})</span></div>
          <div className="cpanel-body">
            <table className="result-grid">
              <thead>
                <tr><th>Property</th><th>Value</th></tr>
              </thead>
              <tbody>
                {extProps.map((p, i) => (
                  <tr key={i}>
                    <td>{p.propertyName}</td>
                    <td>{p.propertyValue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DDL History */}
      <div className="cpanel">
        <div className="cpanel-header"><span className="cpanel-title">DDL History ({filteredDdl.length}/{ddlHistory.length})</span></div>
        <div className="cpanel-body">
          {/* Search */}
          <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input
              value={ddlSearch}
              onChange={e => setDdlSearch(e.target.value)}
              placeholder="Search all fields..."
              style={{ flex: 1, minWidth: 200 }}
            />
            <button className="btn-sm" onClick={() => setShowFilters(v => !v)}>
              {showFilters ? "▾ Filters" : "▸ Filters"}
            </button>
          </div>

          {/* Quick filters */}
          <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
            {Object.keys(OBJECT_TYPE_FILTERS).map(key => (
              <button
                key={key}
                className={`chip ${quickFilter === key ? "chip-active" : ""}`}
                onClick={() => setQuickFilter(prev => prev === key ? null : key)}
              >{key}</button>
            ))}
            {(quickFilter || ddlEventTypes.size > 0 || ddlObjectTypes.size > 0) && (
              <button className="chip chip-clear" onClick={() => { setQuickFilter(null); setDdlEventTypes(new Set()); setDdlObjectTypes(new Set()); }}>Clear</button>
            )}
          </div>

          {/* Expandable filters */}
          {showFilters && (
            <div style={{ marginBottom: 8, padding: 8, background: "var(--bg)", borderRadius: 4 }}>
              <div style={{ marginBottom: 4, fontSize: 11, color: "var(--fg-dim)" }}>Event Types:</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                {allEventTypes.map(t => (
                  <button key={t} className={`chip ${ddlEventTypes.has(t) ? "chip-active" : ""}`}
                    onClick={() => toggleEventType(t)}>{t}</button>
                ))}
              </div>
              <div style={{ marginBottom: 4, fontSize: 11, color: "var(--fg-dim)" }}>Object Types:</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {allObjectTypes.map(t => (
                  <button key={t} className={`chip ${ddlObjectTypes.has(t) ? "chip-active" : ""}`}
                    onClick={() => toggleObjectType(t)}>{t}</button>
                ))}
              </div>
            </div>
          )}

          {/* DDL table */}
          <div className="activity-grid-wrap" style={{ maxHeight: 500 }}>
            <table className="result-grid">
              <thead>
                <tr>
                  <th style={{ width: 30 }}></th>
                  <th>Event</th><th>Time</th><th>Login</th><th>Role</th>
                  <th>Object Type</th><th>Schema</th><th>Object</th><th>Target</th>
                </tr>
              </thead>
              <tbody>
                {filteredDdl.map((e, i) => {
                  const isExp = expandedDdl.has(i);
                  return (
                    <DdlRow key={i} event={e} index={i} isExpanded={isExp} onToggle={() => toggleDdlExpand(i)} />
                  );
                })}
                {filteredDdl.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--fg-dim)" }}>No DDL events found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Action modals */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: "min(90vw, 420px)" }}>
            <div className="modal-header">
              <span>{modal === "grant" ? "Grant Permission" : modal === "createUser" ? "Create User" : "Create Role"}</span>
              <button onClick={() => setModal(null)}>X</button>
            </div>
            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {modal === "grant" && (
                <>
                  <input value={field1} onChange={e => setField1(e.target.value)} placeholder="Permission (e.g. SELECT)" autoFocus />
                  <input value={field2} onChange={e => setField2(e.target.value)} placeholder="User/Login name" />
                </>
              )}
              {modal === "createUser" && (
                <input value={field1} onChange={e => setField1(e.target.value)} placeholder="User name" autoFocus />
              )}
              {modal === "createRole" && (
                <input value={field1} onChange={e => setField1(e.target.value)} placeholder="Role name" autoFocus />
              )}
              {actionResult && (
                <div className={actionResult.success ? "success-msg" : "error-msg"}>{actionResult.message}</div>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={executeAction} disabled={busy || !field1}>{busy ? "..." : "Execute"}</button>
              <button onClick={() => setModal(null)} style={{ background: "var(--bg-input)" }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* DDL History Row with expandable SQL */
function DdlRow({ event, index, isExpanded, onToggle }: {
  event: DdlHistoryEvent;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const codeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (isExpanded && codeRef.current && event.tsql_command) {
      codeRef.current.textContent = event.tsql_command;
      hljs.highlightElement(codeRef.current);
    }
  }, [isExpanded, event.tsql_command]);

  return (
    <>
      <tr onClick={onToggle} style={{ cursor: "pointer" }}>
        <td style={{ textAlign: "center" }}>{isExpanded ? "▼" : "▶"}</td>
        <td>{event.event_type}</td>
        <td>{event.post_time ? new Date(event.post_time).toLocaleString() : ""}</td>
        <td>{event.login_name}</td>
        <td>{event.role_name}</td>
        <td>{event.object_type}</td>
        <td>{event.schema_name}</td>
        <td>{event.object_name}</td>
        <td>{event.target_object_name}</td>
      </tr>
      {isExpanded && event.tsql_command && (
        <tr>
          <td colSpan={9}>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
              <button className="btn-sm" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(event.tsql_command); }}>Copy</button>
            </div>
            <pre className="detail-code"><code ref={codeRef} className="language-sql">{event.tsql_command}</code></pre>
          </td>
        </tr>
      )}
    </>
  );
}
