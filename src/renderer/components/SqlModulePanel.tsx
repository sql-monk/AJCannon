import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import hljs from "highlight.js/lib/core";
import sqlLang from "highlight.js/lib/languages/sql";
import { bridge } from "../bridge";
import { CollapsiblePanel, CollapsiblePanelRef } from "./CollapsiblePanel";
import { PageHeader } from "./PageHeader";
import type {
  SqlModuleInfo,
  SqlModuleParameter,
  SqlModuleDependency,
  DdlHistoryEvent,
} from "../../shared/types";

hljs.registerLanguage("sql", sqlLang);

interface Props {
  server: string;
  database: string;
  schema: string;
  objectName: string;
  objectType: string;
  onShowSql?: (prefix: string) => void;
}

export function SqlModulePanel({ server, database, schema, objectName, objectType, onShowSql }: Props) {
  /* ---- Info ---- */
  const [info, setInfo] = useState<SqlModuleInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoError, setInfoError] = useState("");
  const infoRef = useRef<CollapsiblePanelRef>(null);

  const loadInfo = useCallback(async () => {
    setInfoLoading(true); setInfoError("");
    try { setInfo(await bridge.getModuleInfo(server, database, schema, objectName)); }
    catch (e: unknown) { setInfoError(e instanceof Error ? e.message : String(e)); }
    finally { setInfoLoading(false); }
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

  /* ---- Parameters ---- */
  const [params, setParams] = useState<SqlModuleParameter[]>([]);
  const [paramLoading, setParamLoading] = useState(false);
  const [paramError, setParamError] = useState("");
  const paramRef = useRef<CollapsiblePanelRef>(null);

  const loadParams = useCallback(async () => {
    setParamLoading(true); setParamError("");
    try { setParams(await bridge.getModuleParameters(server, database, schema, objectName)); }
    catch (e: unknown) { setParamError(e instanceof Error ? e.message : String(e)); }
    finally { setParamLoading(false); }
  }, [server, database, schema, objectName]);

  /* ---- Dependencies ---- */
  const [deps, setDeps] = useState<SqlModuleDependency[]>([]);
  const [depLoading, setDepLoading] = useState(false);
  const [depError, setDepError] = useState("");
  const depRef = useRef<CollapsiblePanelRef>(null);

  const loadDeps = useCallback(async () => {
    setDepLoading(true); setDepError("");
    try { setDeps(await bridge.getModuleDependencies(server, database, schema, objectName)); }
    catch (e: unknown) { setDepError(e instanceof Error ? e.message : String(e)); }
    finally { setDepLoading(false); }
  }, [server, database, schema, objectName]);

  /* ---- DDL History ---- */
  const [ddlHistory, setDdlHistory] = useState<DdlHistoryEvent[]>([]);
  const [ddlLoading, setDdlLoading] = useState(false);
  const [ddlError, setDdlError] = useState("");
  const [expandedDdl, setExpandedDdl] = useState<Set<number>>(new Set());
  const ddlRef = useRef<CollapsiblePanelRef>(null);

  const loadDdlHistory = useCallback(async () => {
    setDdlLoading(true); setDdlError("");
    try { setDdlHistory(await bridge.getModuleDdlHistory(server, database, schema, objectName)); }
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
    defRef.current?.refresh();
    paramRef.current?.refresh();
    depRef.current?.refresh();
    ddlRef.current?.refresh();
  }

  function copyDefinition() {
    if (!definition) return;
    navigator.clipboard.writeText(definition);
  }

  async function saveDefinition() {
    if (!definition) return;
    setSaveMsg(null);
    const alterDef = definition.replace(/^\s*CREATE\s+(PROCEDURE|FUNCTION|TRIGGER|VIEW)/i, "ALTER $1");
    const res = await bridge.saveModuleDefinition(server, database, alterDef);
    setSaveMsg({ ok: res.success, text: res.message });
  }

  async function editInEditor() {
    if (!definition) return;
    const tmpPath = `${objectName}.sql`;
    await bridge.openInEditor(tmpPath);
  }

  const typeLabel = objectType === "procedure" ? "Procedure"
    : objectType === "function" ? "Function"
    : objectType === "trigger" ? "Trigger"
    : objectType;

  return (
    <div className="activity-panel" style={{ overflow: "auto", height: "100%" }}>
      <PageHeader
        icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z"/><path d="m10 13-2 2 2 2"/><path d="m14 13 2 2-2 2"/></svg>}
        title={`${schema}.${objectName} (${typeLabel})`}
        server={server}
        breadcrumb={[database, `${schema}.${objectName}`]}
        pageColor="#2a2a4a"
        onRefresh={refreshAll}
      />

      {/* Info */}
      <CollapsiblePanel
        ref={infoRef}
        storageKey={`module:info:${server}:${database}:${schema}.${objectName}`}
        title="Module Info"
        sqlPrefix="module-info"
        onShowSql={onShowSql}
        loadData={loadInfo}
        loading={infoLoading}
        error={infoError}
      >
        {info ? (
          <div className="detail-grid">
            <div className="detail-row"><span className="detail-label">Type</span><span>{info.objectType}</span></div>
            <div className="detail-row"><span className="detail-label">Created</span><span>{info.createdDate}</span></div>
            <div className="detail-row"><span className="detail-label">Modified</span><span>{info.modifiedDate}</span></div>
            <div className="detail-row"><span className="detail-label">ANSI Nulls</span><span>{info.usesAnsiNulls ? "ON" : "OFF"}</span></div>
            <div className="detail-row"><span className="detail-label">Quoted Identifier</span><span>{info.usesQuotedIdentifier ? "ON" : "OFF"}</span></div>
            <div className="detail-row"><span className="detail-label">Schema Bound</span><span>{info.isSchemaBound ? "Yes" : "No"}</span></div>
          </div>
        ) : (
          <div className="loading">Loading...</div>
        )}
      </CollapsiblePanel>

      {/* Parameters (list format) */}
      <CollapsiblePanel
        ref={paramRef}
        storageKey={`module:params:${server}:${database}:${schema}.${objectName}`}
        title={`Parameters (${params.length})`}
        sqlPrefix="module-parameters"
        onShowSql={onShowSql}
        loadData={loadParams}
        loading={paramLoading}
        error={paramError}
      >
        {params.length === 0 ? (
          <div className="loading">No parameters.</div>
        ) : (
          <div className="param-list">
            {params.map((p) => (
              <div key={p.parameterId} className="param-item">
                <span className="param-name">{p.parameterName}</span>
                <span className="param-type">{p.typeName}{p.maxLength > 0 ? `(${p.maxLength})` : ""}</span>
                {p.hasDefault && <span className="param-default">{p.defaultValue ?? "default"}</span>}
                {p.isOutput && <span className="param-output">OUTPUT</span>}
              </div>
            ))}
          </div>
        )}
      </CollapsiblePanel>

      {/* Definition */}
      <CollapsiblePanel
        ref={defRef}
        storageKey={`module:def:${server}:${database}:${schema}.${objectName}`}
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

      {/* Dependencies */}
      <CollapsiblePanel
        ref={depRef}
        storageKey={`module:deps:${server}:${database}:${schema}.${objectName}`}
        title={`Dependencies (${deps.length})`}
        sqlPrefix="module-dependencies"
        onShowSql={onShowSql}
        loadData={loadDeps}
        loading={depLoading}
        error={depError}
      >
        {deps.length === 0 ? (
          <div className="loading">No dependencies found.</div>
        ) : (
          <table className="result-grid">
            <thead>
              <tr><th>Schema</th><th>Entity</th><th>Type</th></tr>
            </thead>
            <tbody>
              {deps.map((d, i) => (
                <tr key={i}>
                  <td>{d.referencedSchema ?? ""}</td>
                  <td>{d.referencedEntity}</td>
                  <td>{d.referencedType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CollapsiblePanel>

      {/* DDL History */}
      <CollapsiblePanel
        ref={ddlRef}
        storageKey={`module:ddl:${server}:${database}:${schema}.${objectName}`}
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
