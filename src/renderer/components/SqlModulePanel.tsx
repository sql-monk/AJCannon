import { useState, useCallback, useRef, useMemo } from "react";
import hljs from "highlight.js/lib/core";
import sqlLang from "highlight.js/lib/languages/sql";
import { bridge } from "../bridge";
import { CollapsiblePanel, CollapsiblePanelRef } from "./CollapsiblePanel";
import type {
  SqlModuleInfo,
  SqlModuleParameter,
  SqlModuleDependency,
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

  /* ---- Refresh all ---- */
  function refreshAll() {
    infoRef.current?.refresh();
    defRef.current?.refresh();
    paramRef.current?.refresh();
    depRef.current?.refresh();
  }

  function copyDefinition() {
    if (!definition) return;
    navigator.clipboard.writeText(definition);
  }

  const typeLabel = objectType === "procedure" ? "Procedure"
    : objectType === "function" ? "Function"
    : objectType === "trigger" ? "Trigger"
    : objectType;

  return (
    <div className="activity-panel" style={{ overflow: "auto", height: "100%" }}>
      <div className="activity-header">
        <h3>⚙ {schema}.{objectName} ({typeLabel}) — {server}/{database}</h3>
        <button onClick={refreshAll}>⟳ Refresh</button>
      </div>

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

      {/* Parameters */}
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
          <table className="result-grid">
            <thead>
              <tr><th>#</th><th>Name</th><th>Type</th><th>Output</th><th>Default</th></tr>
            </thead>
            <tbody>
              {params.map((p) => (
                <tr key={p.parameterId}>
                  <td>{p.parameterId}</td>
                  <td>{p.parameterName}</td>
                  <td>{p.typeName}{p.maxLength > 0 ? `(${p.maxLength})` : ""}</td>
                  <td>{p.isOutput ? "✓" : ""}</td>
                  <td>{p.hasDefault ? (p.defaultValue ?? "—") : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
          <>
            <div style={{ marginBottom: 4 }}>
              <button className="btn-sm" onClick={copyDefinition}>Copy</button>
            </div>
            <pre
              className="detail-code"
              style={{ maxHeight: 600, overflow: "auto" }}
              dangerouslySetInnerHTML={{ __html: highlightedDef }}
            />
          </>
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
    </div>
  );
}
