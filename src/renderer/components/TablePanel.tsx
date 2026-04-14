import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { bridge } from "../bridge";
import { CollapsiblePanel, CollapsiblePanelRef } from "./CollapsiblePanel";
import type {
  TableDetailInfo,
  TableColumnDetail,
  TableTriggerInfo,
  TablePermissionInfo,
  TreeNode,
} from "../../shared/types";

interface Props {
  server: string;
  database: string;
  schema: string;
  objectName: string;
  onShowSql?: (prefix: string) => void;
}

export function TablePanel({ server, database, schema, objectName, onShowSql }: Props) {
  /* ---- Info ---- */
  const [info, setInfo] = useState<TableDetailInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoError, setInfoError] = useState("");
  const infoRef = useRef<CollapsiblePanelRef>(null);

  const loadInfo = useCallback(async () => {
    setInfoLoading(true); setInfoError("");
    try { setInfo(await bridge.getTableDetail(server, database, schema, objectName)); }
    catch (e: unknown) { setInfoError(e instanceof Error ? e.message : String(e)); }
    finally { setInfoLoading(false); }
  }, [server, database, schema, objectName]);

  /* ---- Data Sample ---- */
  const [sample, setSample] = useState<Record<string, unknown>[]>([]);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [sampleError, setSampleError] = useState("");
  const sampleRef = useRef<CollapsiblePanelRef>(null);
  const [showSampleSql, setShowSampleSql] = useState(false);

  const loadSample = useCallback(async () => {
    setSampleLoading(true); setSampleError("");
    try { setSample(await bridge.getTableDataSample(server, database, schema, objectName)); }
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
    try { setColumns(await bridge.getTableColumnsDetail(server, database, schema, objectName)); }
    catch (e: unknown) { setColsError(e instanceof Error ? e.message : String(e)); }
    finally { setColsLoading(false); }
  }, [server, database, schema, objectName]);

  /* ---- Indexes ---- */
  const [indexes, setIndexes] = useState<TreeNode[]>([]);
  const [idxLoading, setIdxLoading] = useState(false);
  const [idxError, setIdxError] = useState("");
  const idxRef = useRef<CollapsiblePanelRef>(null);

  const loadIndexes = useCallback(async () => {
    setIdxLoading(true); setIdxError("");
    try { setIndexes(await bridge.getTableIndexes(server, database, schema, objectName)); }
    catch (e: unknown) { setIdxError(e instanceof Error ? e.message : String(e)); }
    finally { setIdxLoading(false); }
  }, [server, database, schema, objectName]);

  /* ---- Triggers ---- */
  const [triggers, setTriggers] = useState<TableTriggerInfo[]>([]);
  const [trigLoading, setTrigLoading] = useState(false);
  const [trigError, setTrigError] = useState("");
  const trigRef = useRef<CollapsiblePanelRef>(null);

  const loadTriggers = useCallback(async () => {
    setTrigLoading(true); setTrigError("");
    try { setTriggers(await bridge.getTableTriggers(server, database, schema, objectName)); }
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
    try { setPerms(await bridge.getTablePermissions(server, database, schema, objectName)); }
    catch (e: unknown) { setPermError(e instanceof Error ? e.message : String(e)); }
    finally { setPermLoading(false); }
  }, [server, database, schema, objectName]);

  /* ---- Refresh all ---- */
  function refreshAll() {
    infoRef.current?.refresh();
    sampleRef.current?.refresh();
    colsRef.current?.refresh();
    idxRef.current?.refresh();
    trigRef.current?.refresh();
    permRef.current?.refresh();
  }

  /* ---- Sample column keys ---- */
  const sampleKeys = useMemo(() => {
    if (sample.length === 0) return [];
    return Object.keys(sample[0]);
  }, [sample]);

  return (
    <div className="activity-panel" style={{ overflow: "auto", height: "100%" }}>
      <div className="activity-header">
        <h3>📋 {schema}.{objectName} — {server}/{database}</h3>
        <button onClick={refreshAll}>⟳ Refresh</button>
      </div>

      {/* Info */}
      <CollapsiblePanel
        ref={infoRef}
        storageKey={`table:info:${server}:${database}:${schema}.${objectName}`}
        title="Table Info"
        sqlPrefix="table-detail"
        onShowSql={onShowSql}
        loadData={loadInfo}
        loading={infoLoading}
        error={infoError}
      >
        {info ? (
          <div className="detail-grid">
            <div className="detail-row"><span className="detail-label">Rows</span><span>{info.rowsCount?.toLocaleString()}</span></div>
            <div className="detail-row"><span className="detail-label">Total Space</span><span>{info.totalSpaceMB} MB</span></div>
            <div className="detail-row"><span className="detail-label">Used Space</span><span>{info.usedSpaceMB} MB</span></div>
            <div className="detail-row"><span className="detail-label">Created</span><span>{info.createdDate}</span></div>
            <div className="detail-row"><span className="detail-label">Modified</span><span>{info.modifiedDate}</span></div>
            <div className="detail-row"><span className="detail-label">Has Identity</span><span>{info.hasIdentity ? "Yes" : "No"}</span></div>
            <div className="detail-row"><span className="detail-label">Lock Escalation</span><span>{info.lockEscalation}</span></div>
          </div>
        ) : (
          <div className="loading">Loading...</div>
        )}
      </CollapsiblePanel>

      {/* Data Sample */}
      <CollapsiblePanel
        ref={sampleRef}
        storageKey={`table:sample:${server}:${database}:${schema}.${objectName}`}
        title={`Data Sample (${sample.length} rows)`}
        sqlPrefix="table-data"
        onShowSql={() => setShowSampleSql((s) => !s)}
        loadData={loadSample}
        loading={sampleLoading}
        error={sampleError}
      >
        {showSampleSql && (
          <pre style={{ background: "var(--bg-alt)", padding: 8, borderRadius: 4, marginBottom: 8, fontSize: 12, whiteSpace: "pre-wrap" }}>
            {`SELECT TOP 10 * FROM [${schema}].[${objectName}];`}
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
        storageKey={`table:cols:${server}:${database}:${schema}.${objectName}`}
        title={`Columns (${columns.length})`}
        sqlPrefix="table-columns-detail"
        onShowSql={onShowSql}
        loadData={loadColumns}
        loading={colsLoading}
        error={colsError}
      >
        {columns.length === 0 ? (
          <div className="loading">No columns.</div>
        ) : (
          <table className="result-grid">
            <thead>
              <tr>
                <th>#</th><th>Name</th><th>Type</th><th>Nullable</th><th>Identity</th><th>Default</th><th>Computed</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((c) => (
                <tr key={c.columnId}>
                  <td>{c.columnId}</td>
                  <td>{c.name}</td>
                  <td>{c.typeName}{c.maxLength > 0 ? `(${c.maxLength})` : ""}</td>
                  <td>{c.isNullable ? "✓" : ""}</td>
                  <td>{c.isIdentity ? `✓ (${c.identitySeed},${c.identityIncrement})` : ""}</td>
                  <td style={{ fontSize: 11 }}>{c.defaultValue ?? ""}</td>
                  <td style={{ fontSize: 11 }}>{c.isComputed ? c.computedDefinition : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CollapsiblePanel>

      {/* Indexes */}
      <CollapsiblePanel
        ref={idxRef}
        storageKey={`table:idx:${server}:${database}:${schema}.${objectName}`}
        title={`Indexes (${indexes.length})`}
        sqlPrefix="table-indexes"
        onShowSql={onShowSql}
        loadData={loadIndexes}
        loading={idxLoading}
        error={idxError}
      >
        {indexes.length === 0 ? (
          <div className="loading">No indexes.</div>
        ) : (
          <table className="result-grid">
            <thead>
              <tr><th>Name</th><th>Type</th></tr>
            </thead>
            <tbody>
              {indexes.map((idx) => (
                <tr key={idx.id}>
                  <td>{idx.label}</td>
                  <td>{(idx.meta as Record<string, unknown>)?.indexId != null ? String((idx.meta as Record<string, unknown>).indexId) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CollapsiblePanel>

      {/* Triggers */}
      <CollapsiblePanel
        ref={trigRef}
        storageKey={`table:trig:${server}:${database}:${schema}.${objectName}`}
        title={`Triggers (${triggers.length})`}
        sqlPrefix="table-triggers"
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
        storageKey={`table:perm:${server}:${database}:${schema}.${objectName}`}
        title={`Permissions (${perms.length})`}
        sqlPrefix="table-permissions"
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
    </div>
  );
}
