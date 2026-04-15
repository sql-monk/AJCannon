import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import hljs from "highlight.js/lib/core";
import sqlLang from "highlight.js/lib/languages/sql";
import { bridge } from "../bridge";
import { CollapsiblePanel, CollapsiblePanelRef } from "./CollapsiblePanel";
import { PageHeader } from "./PageHeader";
import type {
  ViewDetailInfo,
  TableColumnDetail,
  TableTriggerInfo,
  TablePermissionInfo,
  DdlHistoryEvent,
} from "../../shared/types";

hljs.registerLanguage("sql", sqlLang);

interface Props {
  server: string;
  database: string;
  schema: string;
  objectName: string;
  onShowSql?: (prefix: string) => void;
}

export function ViewPanel({ server, database, schema, objectName, onShowSql }: Props) {
  /* ---- Info ---- */
  const [info, setInfo] = useState<ViewDetailInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoError, setInfoError] = useState("");
  const infoRef = useRef<CollapsiblePanelRef>(null);

  const loadInfo = useCallback(async () => {
    setInfoLoading(true); setInfoError("");
    try { setInfo(await bridge.getViewDetail(server, database, schema, objectName)); }
    catch (e: unknown) { setInfoError(e instanceof Error ? e.message : String(e)); }
    finally { setInfoLoading(false); }
  }, [server, database, schema, objectName]);

  /* ---- Data Sample ---- */
  const [sample, setSample] = useState<Record<string, unknown>[]>([]);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [sampleError, setSampleError] = useState("");
  const sampleRef = useRef<CollapsiblePanelRef>(null);
  const [showSampleSql, setShowSampleSql] = useState(false);

  const sampleSqlText = `SELECT TOP(10) * FROM [${schema}].[${objectName}];`;
  const sampleSqlHighlighted = useMemo(() => {
    return hljs.highlight(sampleSqlText, { language: "sql" }).value;
  }, [sampleSqlText]);

  const loadSample = useCallback(async () => {
    setSampleLoading(true); setSampleError("");
    try { setSample(await bridge.getViewDataSample(server, database, schema, objectName)); }
    catch (e: unknown) { setSampleError(e instanceof Error ? e.message : String(e)); }
    finally { setSampleLoading(false); }
  }, [server, database, schema, objectName]);

  /* ---- Columns ---- */
  const [columns, setColumns] = useState<TableColumnDetail[]>([]);
  const [colsLoading, setColsLoading] = useState(false);
  const [colsError, setColsError] = useState("");
  const colsRef = useRef<CollapsiblePanelRef>(null);

  const loadColumns = useCallback(async () => {
    setColsLoading(true); setColsError("");
    try { setColumns(await bridge.getViewColumns(server, database, schema, objectName)); }
    catch (e: unknown) { setColsError(e instanceof Error ? e.message : String(e)); }
    finally { setColsLoading(false); }
  }, [server, database, schema, objectName]);

  /* ---- Definition ---- */
  const [definition, setDefinition] = useState("");
  const [defLoading, setDefLoading] = useState(false);
  const [defError, setDefError] = useState("");
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const defRef = useRef<CollapsiblePanelRef>(null);

  const loadDefinition = useCallback(async () => {
    setDefLoading(true); setDefError("");
    try { setDefinition(await bridge.getModuleDefinition(server, database, schema, objectName)); }
    catch (e: unknown) { setDefError(e instanceof Error ? e.message : String(e)); }
    finally { setDefLoading(false); }
  }, [server, database, schema, objectName]);

  const highlightedDef = useMemo(() => {
    if (!definition) return "";
    return hljs.highlight(definition, { language: "sql" }).value;
  }, [definition]);

  /* ---- Triggers ---- */
  const [triggers, setTriggers] = useState<TableTriggerInfo[]>([]);
  const [trigLoading, setTrigLoading] = useState(false);
  const [trigError, setTrigError] = useState("");
  const trigRef = useRef<CollapsiblePanelRef>(null);

  const loadTriggers = useCallback(async () => {
    setTrigLoading(true); setTrigError("");
    try { setTriggers(await bridge.getViewTriggers(server, database, schema, objectName)); }
    catch (e: unknown) { setTrigError(e instanceof Error ? e.message : String(e)); }
    finally { setTrigLoading(false); }
  }, [server, database, schema, objectName]);

  /* ---- Permissions ---- */
  const [perms, setPerms] = useState<TablePermissionInfo[]>([]);
  const [permLoading, setPermLoading] = useState(false);
  const [permError, setPermError] = useState("");
  const permRef = useRef<CollapsiblePanelRef>(null);

  const loadPerms = useCallback(async () => {
    setPermLoading(true); setPermError("");
    try { setPerms(await bridge.getViewPermissions(server, database, schema, objectName)); }
    catch (e: unknown) { setPermError(e instanceof Error ? e.message : String(e)); }
    finally { setPermLoading(false); }
  }, [server, database, schema, objectName]);

  /* ---- DDL History ---- */
  const [ddlHistory, setDdlHistory] = useState<DdlHistoryEvent[]>([]);
  const [ddlLoading, setDdlLoading] = useState(false);
  const [ddlError, setDdlError] = useState("");
  const [expandedDdl, setExpandedDdl] = useState<Set<number>>(new Set());
  const ddlRef = useRef<CollapsiblePanelRef>(null);

  const loadDdlHistory = useCallback(async () => {
    setDdlLoading(true); setDdlError("");
    try { setDdlHistory(await bridge.getViewDdlHistory(server, database, schema, objectName)); }
    catch (e: unknown) { setDdlError(e instanceof Error ? e.message : String(e)); }
    finally { setDdlLoading(false); }
  }, [server, database, schema, objectName]);

  function toggleDdlExpand(i: number) {
    setExpandedDdl(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  /* ---- Refresh all ---- */
  function refreshAll() {
    infoRef.current?.refresh();
    sampleRef.current?.refresh();
    colsRef.current?.refresh();
    defRef.current?.refresh();
    trigRef.current?.refresh();
    permRef.current?.refresh();
    ddlRef.current?.refresh();
  }

  function copyDefinition() {
    if (!definition) return;
    navigator.clipboard.writeText(definition);
  }

  async function saveDefinition() {
    if (!definition) return;
    setSaveMsg(null);
    const alterDef = definition.replace(/^\s*CREATE\s+(VIEW)/i, "ALTER $1");
    const res = await bridge.saveModuleDefinition(server, database, alterDef);
    setSaveMsg({ ok: res.success, text: res.message });
  }

  async function editInEditor() {
    if (!definition) return;
    const tmpPath = `${objectName}.sql`;
    await bridge.openInEditor(tmpPath);
  }

  /* ---- Sample column keys ---- */
  const sampleKeys = useMemo(() => {
    if (sample.length === 0) return [];
    return Object.keys(sample[0]);
  }, [sample]);

  return (
    <div className="activity-panel" style={{ overflow: "auto", height: "100%" }}>
      <PageHeader
        icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg>}
        title={`${schema}.${objectName}`}
        server={server}
        breadcrumb={[database, `${schema}.${objectName}`]}
        pageColor="#2a4a3a"
        onRefresh={refreshAll}
      />

      {/* Info */}
      <CollapsiblePanel
        ref={infoRef}
        storageKey={`view:info:${server}:${database}:${schema}.${objectName}`}
        title="View Info"
        sqlPrefix="view-detail"
        onShowSql={onShowSql}
        loadData={loadInfo}
        loading={infoLoading}
        error={infoError}
      >
        {info ? (
          <div className="detail-grid">
            <div className="detail-row"><span className="detail-label">Rows</span><span>{info.rowsCount?.toLocaleString()}</span></div>
            <div className="detail-row"><span className="detail-label">Created</span><span>{info.createdDate}</span></div>
            <div className="detail-row"><span className="detail-label">Modified</span><span>{info.modifiedDate}</span></div>
            <div className="detail-row"><span className="detail-label">Updatable</span><span>{info.isUpdatable ? "Yes" : "No"}</span></div>
            <div className="detail-row"><span className="detail-label">Schema Bound</span><span>{info.isSchemaBound ? "Yes" : "No"}</span></div>
            {info.checkOption && <div className="detail-row"><span className="detail-label">Check Option</span><span>{info.checkOption}</span></div>}
          </div>
        ) : (
          <div className="loading">Loading...</div>
        )}
      </CollapsiblePanel>

      {/* Data Sample */}
      <CollapsiblePanel
        ref={sampleRef}
        storageKey={`view:sample:${server}:${database}:${schema}.${objectName}`}
        title={`Data Sample (${sample.length} rows)`}
        sqlPrefix="view-data"
        onShowSql={() => setShowSampleSql((s) => !s)}
        loadData={loadSample}
        loading={sampleLoading}
        error={sampleError}
      >
        {showSampleSql && (
          <pre className="detail-code hljs" style={{ marginBottom: 8, fontSize: 12 }}>
            <code dangerouslySetInnerHTML={{ __html: sampleSqlHighlighted }} />
          </pre>
        )}
        {sample.length === 0 ? (
          <div className="loading">No data.</div>
        ) : (
          <div style={{ overflow: "auto", maxHeight: 400 }}>
            <table className="result-grid">
              <thead>
                <tr>
                  {sampleKeys.map((k) => <th key={k}>{k}</th>)}
                </tr>
              </thead>
              <tbody>
                {sample.map((row, i) => (
                  <tr key={i}>
                    {sampleKeys.map((k) => (
                      <td key={k}>{row[k] == null ? <span style={{ color: "var(--fg-dim)" }}>NULL</span> : String(row[k])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CollapsiblePanel>

      {/* Columns */}
      <CollapsiblePanel
        ref={colsRef}
        storageKey={`view:cols:${server}:${database}:${schema}.${objectName}`}
        title={`Columns (${columns.length})`}
        sqlPrefix="view-columns"
        onShowSql={onShowSql}
        loadData={loadColumns}
        loading={colsLoading}
        error={colsError}
      >
        {columns.length === 0 ? (
          <div className="loading">No columns.</div>
        ) : (
          <div className="param-list">
            {columns.map((c) => {
              const typeStr = c.typeName + (c.maxLength > 0 ? `(${c.maxLength})` : "");
              return (
                <div key={c.columnId} className="param-item" style={{ fontSize: 12 }}>
                  <span className="param-name">{c.name}</span>
                  <span className="param-type">({typeStr})</span>
                  <span style={{ color: c.isNullable ? "var(--fg-dim)" : "var(--fg)" }}>{c.isNullable ? "null" : "not null"}</span>
                  {c.isComputed && <span style={{ color: "var(--fg-dim)", fontSize: 11 }}>computed: {c.computedDefinition}</span>}
                </div>
              );
            })}
          </div>
        )}
      </CollapsiblePanel>

      {/* Definition */}
      <CollapsiblePanel
        ref={defRef}
        storageKey={`view:def:${server}:${database}:${schema}.${objectName}`}
        title="Definition"
        sqlPrefix="module-definition"
        onShowSql={onShowSql}
        loadData={loadDefinition}
        loading={defLoading}
        error={defError}
      >
        {definition ? (
          <div style={{ position: "relative" }}>
            <div className="def-toolbar">
              <button className="btn-sm btn-icon" onClick={copyDefinition} title="Copy">
                <svg viewBox="0 0 16 16" width="14" height="14"><rect x="5" y="1" width="9" height="11" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2"/><rect x="2" y="4" width="9" height="11" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2"/></svg>
              </button>
              <button className="btn-sm btn-icon" onClick={saveDefinition} title="Save (ALTER)">
                <svg viewBox="0 0 16 16" width="14" height="14"><path d="M2 2h9l3 3v9H2z" fill="none" stroke="currentColor" strokeWidth="1.2"/><rect x="4" y="2" width="6" height="4" fill="none" stroke="currentColor" strokeWidth="0.8"/><rect x="4" y="10" width="8" height="4" fill="none" stroke="currentColor" strokeWidth="0.8"/></svg>
              </button>
              <button className="btn-sm btn-icon" onClick={editInEditor} title="Edit in editor">
                <svg viewBox="0 0 16 16" width="14" height="14"><path d="M11.5 1.5l3 3-9 9H2.5v-3z" fill="none" stroke="currentColor" strokeWidth="1.2"/></svg>
              </button>
            </div>
            {saveMsg && (
              <div className={saveMsg.ok ? "success-msg" : "error-msg"} style={{ marginBottom: 4 }}>{saveMsg.text}</div>
            )}
            <pre
              className="detail-code hljs"
              style={{ maxHeight: 600, overflow: "auto" }}
              dangerouslySetInnerHTML={{ __html: highlightedDef }}
            />
          </div>
        ) : (
          <div className="loading">No definition available.</div>
        )}
      </CollapsiblePanel>

      {/* Triggers */}
      <CollapsiblePanel
        ref={trigRef}
        storageKey={`view:trig:${server}:${database}:${schema}.${objectName}`}
        title={`Triggers (${triggers.length})`}
        sqlPrefix="view-triggers"
        onShowSql={onShowSql}
        loadData={loadTriggers}
        loading={trigLoading}
        error={trigError}
      >
        {triggers.length === 0 ? (
          <div className="loading">No triggers.</div>
        ) : (
          <table className="result-grid">
            <thead>
              <tr><th>Name</th><th>Enabled</th><th>Type</th><th>Events</th><th>Created</th></tr>
            </thead>
            <tbody>
              {triggers.map((t) => (
                <tr key={t.triggerName}>
                  <td>{t.triggerName}</td>
                  <td>{t.isEnabled ? "✓" : "✗"}</td>
                  <td>{t.isInsteadOf ? "INSTEAD OF" : "AFTER"}</td>
                  <td>{t.eventType}</td>
                  <td>{t.createdDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CollapsiblePanel>

      {/* Permissions */}
      <CollapsiblePanel
        ref={permRef}
        storageKey={`view:perm:${server}:${database}:${schema}.${objectName}`}
        title={`Permissions (${perms.length})`}
        sqlPrefix="view-permissions"
        onShowSql={onShowSql}
        loadData={loadPerms}
        loading={permLoading}
        error={permError}
      >
        {perms.length === 0 ? (
          <div className="loading">No explicit permissions.</div>
        ) : (
          <table className="result-grid">
            <thead>
              <tr><th>Principal</th><th>Type</th><th>Permission</th><th>State</th></tr>
            </thead>
            <tbody>
              {perms.map((p, i) => (
                <tr key={i}>
                  <td>{p.principalName}</td>
                  <td>{p.principalType}</td>
                  <td>{p.permissionName}</td>
                  <td>{p.stateDesc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CollapsiblePanel>

      {/* DDL History */}
      <CollapsiblePanel
        ref={ddlRef}
        storageKey={`view:ddl:${server}:${database}:${schema}.${objectName}`}
        title={`DDL History (${ddlHistory.length})`}
        sqlPrefix="database-ddl-history"
        onShowSql={onShowSql}
        loadData={loadDdlHistory}
        loading={ddlLoading}
        error={ddlError}
      >
        {ddlHistory.length === 0 ? (
          <div className="loading">No DDL events found.</div>
        ) : (
          <div className="activity-grid-wrap" style={{ maxHeight: 400 }}>
            <table className="result-grid">
              <thead>
                <tr>
                  <th style={{ width: 30 }}></th>
                  <th>Event</th><th>Time</th><th>Login</th>
                </tr>
              </thead>
              <tbody>
                {ddlHistory.map((e, i) => {
                  const isExp = expandedDdl.has(i);
                  return (
                    <DdlRow key={i} event={e} index={i} isExpanded={isExp} onToggle={() => toggleDdlExpand(i)} />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CollapsiblePanel>
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
      </tr>
      {isExpanded && event.tsql_command && (
        <tr>
          <td colSpan={4}>
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
