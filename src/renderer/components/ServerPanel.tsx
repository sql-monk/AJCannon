import { useState, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { bridge } from "../bridge";
import { CollapsiblePanel, CollapsiblePanelRef } from "./CollapsiblePanel";
import { PageHeader } from "./PageHeader";
import type { ServerInfo, VolumeSpaceInfo, ServerService, RamOverview, AvailabilityGroupInfo, CmdResult, ServerConfigOption, CpuSnapshot, DatabaseSpaceOnVolume, FileSpaceInfo, ObjectSpaceInfo, ShrinkRequest, CpuByDatabase } from "../../shared/types";

interface Props {
  server: string;
  onShowSql?: (prefix: string) => void;
}

export function ServerPanel({ server, onShowSql }: Props) {
  const cpuRef = useRef<CollapsiblePanelRef>(null);
  const ramRef = useRef<CollapsiblePanelRef>(null);
  const cpuByDbRef = useRef<CollapsiblePanelRef>(null);
  const diskRef = useRef<CollapsiblePanelRef>(null);
  const agRef = useRef<CollapsiblePanelRef>(null);
  const svcRef = useRef<CollapsiblePanelRef>(null);
  const cfgRef = useRef<CollapsiblePanelRef>(null);

  function refreshAll() {
    cpuRef.current?.refresh();
    ramRef.current?.refresh();
    cpuByDbRef.current?.refresh();
    diskRef.current?.refresh();
    agRef.current?.refresh();
    svcRef.current?.refresh();
    cfgRef.current?.refresh();
  }

  const serverIcon = <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 128 128"><path fill="#ccc" d="M33 8h62v112H33z"/><path fill="#666" d="M70 40H58v-8h12zm0 16H58v-8h12zm0-32H58V16h12z"/></svg>;

  return (
    <div className="page-panel">
      <PageHeader icon={serverIcon} title={`Server — ${server}`} server={server} pageColor="#264f78" onRefresh={refreshAll} />

      <ActionsSection server={server} />
      <CpuSection ref={cpuRef} server={server} onShowSql={onShowSql} />
      <DiskSection ref={diskRef} server={server} onShowSql={onShowSql} />
      <CpuByDbSection ref={cpuByDbRef} server={server} onShowSql={onShowSql} />
      <AvailabilityGroupsSection ref={agRef} server={server} onShowSql={onShowSql} />
      <RamSection ref={ramRef} server={server} onShowSql={onShowSql} />
      <ConfigSection ref={cfgRef} server={server} onShowSql={onShowSql} />
      <ServicesSection ref={svcRef} server={server} onShowSql={onShowSql} />
    </div>
  );
}

/* ------------ Shared section props ------------ */
interface SectionProps {
  server: string;
  onShowSql?: (prefix: string) => void;
}

/* ==== Actions Section (no data, just buttons) ==== */
function ActionsSection({ server }: { server: string }) {
  const [modal, setModal] = useState<"db" | "login" | "grant" | null>(null);
  const [field1, setField1] = useState("");
  const [field2, setField2] = useState("");
  const [result, setResult] = useState<CmdResult | null>(null);
  const [busy, setBusy] = useState(false);

  function openModal(type: "db" | "login" | "grant") {
    setModal(type);
    setField1("");
    setField2("");
    setResult(null);
  }

  async function execute() {
    setBusy(true);
    setResult(null);
    try {
      let res: CmdResult;
      if (modal === "db") {
        res = await bridge.createDatabase(server, field1);
      } else if (modal === "login") {
        res = await bridge.createLogin(server, field1, field2);
      } else {
        res = await bridge.grantPermission(server, field1, field2);
      }
      setResult(res);
    } catch (e: unknown) {
      setResult({ success: false, message: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="cpanel">
        <div className="cpanel-body" style={{ display: "flex", gap: 8, padding: "8px 10px", alignItems: "center" }}>
          <button onClick={() => openModal("grant")}>Grant Permission</button>
          <span style={{ color: "var(--fg-dim)", margin: "0 4px" }}>|</span>
          <span style={{ color: "var(--fg-dim)", fontSize: 12 }}>new</span>
          <button onClick={() => openModal("db")}>Create DB</button>
          <button onClick={() => openModal("login")}>Create Login</button>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: "min(90vw, 420px)" }}>
            <div className="modal-header">
              <span>{modal === "db" ? "Create Database" : modal === "login" ? "Create Login" : "Grant Permission"}</span>
              <button onClick={() => setModal(null)}>X</button>
            </div>
            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {modal === "db" && (
                <input value={field1} onChange={(e) => setField1(e.target.value)} placeholder="Database name" autoFocus />
              )}
              {modal === "login" && (
                <>
                  <input value={field1} onChange={(e) => setField1(e.target.value)} placeholder="Login name" autoFocus />
                  <input value={field2} onChange={(e) => setField2(e.target.value)} placeholder="Password" type="password" />
                </>
              )}
              {modal === "grant" && (
                <>
                  <input value={field1} onChange={(e) => setField1(e.target.value)} placeholder="Permission (e.g. VIEW SERVER STATE)" autoFocus />
                  <input value={field2} onChange={(e) => setField2(e.target.value)} placeholder="Login name" />
                </>
              )}
              {result && (
                <div className={result.success ? "success-msg" : "error-msg"}>{result.message}</div>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={execute} disabled={busy || !field1}>{busy ? "..." : "Execute"}</button>
              <button onClick={() => setModal(null)} style={{ background: "var(--bg-input)" }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ==== Volumes Section (formerly Disks) ==== */
const DiskSection = forwardRef<CollapsiblePanelRef, SectionProps>(function DiskSection({ server, onShowSql }, ref) {
  const [disks, setDisks] = useState<VolumeSpaceInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedVol, setExpandedVol] = useState<string | null>(null);
  const [volDbs, setVolDbs] = useState<DatabaseSpaceOnVolume[]>([]);
  const [expandedDb, setExpandedDb] = useState<string | null>(null);
  const [dbFiles, setDbFiles] = useState<FileSpaceInfo[]>([]);
  const [expandedFile, setExpandedFile] = useState<number | null>(null);
  const [fileObjects, setFileObjects] = useState<ObjectSpaceInfo[]>([]);
  const [subLoading, setSubLoading] = useState(false);
  const [shrinkMsg, setShrinkMsg] = useState("");
  const [shrinkConfirm, setShrinkConfirm] = useState<{ dbName: string; fileId: number; fileName: string } | null>(null);
  const [shrinkConfirmText, setShrinkConfirmText] = useState("");
  const panelRef = useRef<CollapsiblePanelRef>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await bridge.getVolumes(server);
      data.sort((a, b) => a.volumeMountPoint.localeCompare(b.volumeMountPoint));
      setDisks(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [server]);

  useImperativeHandle(ref, () => ({
    refresh() { panelRef.current?.refresh(); },
    isCollapsed() { return panelRef.current?.isCollapsed() ?? false; },
  }), []);

  async function toggleVolume(vol: string) {
    if (expandedVol === vol) {
      setExpandedVol(null);
      return;
    }
    setExpandedVol(vol);
    setExpandedDb(null);
    setExpandedFile(null);
    setVolDbs([]);
    setDbFiles([]);
    setFileObjects([]);
    setSubLoading(true);
    try {
      setVolDbs(await bridge.getDbSpace(server, vol));
    } finally {
      setSubLoading(false);
    }
  }

  async function toggleDb(dbName: string) {
    if (expandedDb === dbName) {
      setExpandedDb(null);
      return;
    }
    setExpandedDb(dbName);
    setExpandedFile(null);
    setDbFiles([]);
    setFileObjects([]);
    setSubLoading(true);
    try {
      setDbFiles(await bridge.getFileSpace(server, dbName));
    } finally {
      setSubLoading(false);
    }
  }

  async function toggleFile(fileId: number) {
    if (expandedFile === fileId) {
      setExpandedFile(null);
      return;
    }
    setExpandedFile(fileId);
    setFileObjects([]);
    setSubLoading(true);
    try {
      setFileObjects(await bridge.getObjectSpace(server, expandedDb!, fileId));
    } finally {
      setSubLoading(false);
    }
  }

  async function handleShrink(dbName: string, fileId: number) {
    setShrinkMsg("");
    const result = await bridge.shrink({ server, databaseName: dbName, fileId });
    setShrinkMsg(result.message);
    if (expandedDb) {
      setDbFiles(await bridge.getFileSpace(server, expandedDb));
    }
  }

  function requestShrink(dbName: string, fileId: number, fileName: string, fileType: string) {
    if (fileType === "LOG") {
      handleShrink(dbName, fileId);
    } else {
      setShrinkConfirm({ dbName, fileId, fileName });
      setShrinkConfirmText("");
    }
  }

  async function confirmShrink() {
    if (!shrinkConfirm || shrinkConfirmText !== "shrink") return;
    await handleShrink(shrinkConfirm.dbName, shrinkConfirm.fileId);
    setShrinkConfirm(null);
    setShrinkConfirmText("");
  }

  function volumeColor(d: VolumeSpaceInfo): string {
    const freePct = d.totalMB > 0 ? (d.freeMB / d.totalMB) * 100 : 100;
    if (freePct < 10) return "rgb(140, 40, 40)";
    if (freePct < 25) return "rgb(200, 80, 30)";
    return "rgb(20, 100, 20)";
  }

  function formatSize(mb: number): string {
    if (mb >= 1048576) return `${(mb / 1048576).toFixed(2)} TB`;
    if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${(mb * 1024).toFixed(0)} KB`;
  }

  function fileBarColor(type: string, isReadOnly: boolean): string {
    if (isReadOnly) return "#999";
    if (type === "LOG") return "#b8860b";
    return "#1a4a7a";
  }

  function fileFreeColor(): string {
    return "#555";
  }

  function shrinkBtnColor(type: string): string {
    if (type === "LOG") return "rgb(40, 100, 40)";
    return "rgb(140, 40, 40)";
  }

  const maxFileSizeMB = dbFiles.length > 0 ? Math.max(...dbFiles.map(f => f.sizeMB)) : 1;
  const maxDbSizeMB = volDbs.length > 0 ? Math.max(...volDbs.map(d => d.totalSizeMB)) : 1;

  /** Yellow cylinder database icon (matches ObjectExplorer tree icon) */
  function dbIconSvg() {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14" style={{ flexShrink: 0 }}>
        <ellipse cx="8" cy="4" rx="6" ry="2.5" fill="#e5c07b" />
        <path d="M2 4v8c0 1.38 2.69 2.5 6 2.5s6-1.12 6-2.5V4" fill="#e5c07b" opacity="0.75" />
        <ellipse cx="8" cy="12" rx="6" ry="2.5" fill="#e5c07b" opacity="0.6" />
      </svg>
    );
  }

  return (
    <CollapsiblePanel ref={panelRef} storageKey={`server:disks:${server}`} title="Volumes" sqlPrefix="volume" onShowSql={onShowSql} loadData={load} loading={loading} error={error}>
      {shrinkMsg && <div className="success-msg" style={{ marginBottom: 8 }}>{shrinkMsg}</div>}
      {/* Shrink confirmation dialog for data files */}
      {shrinkConfirm && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h4>Shrink "{shrinkConfirm.fileName}"?</h4>
            <div style={{ marginBottom: 8 }}>Type <b>shrink</b> to confirm:</div>
            <input value={shrinkConfirmText} onChange={(e) => setShrinkConfirmText(e.target.value)}
              placeholder="shrink" style={{ width: "100%", marginBottom: 8 }} autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") confirmShrink(); }} />
            <div className="modal-actions">
              <button className="danger" onClick={confirmShrink} disabled={shrinkConfirmText !== "shrink"}>Shrink</button>
              <button onClick={() => setShrinkConfirm(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      <div className="disk-bars">
        {disks.map((d) => {
          const pct = d.totalMB > 0 ? Math.round((d.usedMB / d.totalMB) * 100) : 0;
          const freePct = 100 - pct;
          const color = volumeColor(d);
          const isExpanded = expandedVol === d.volumeMountPoint;
          return (
            <div key={d.volumeMountPoint}>
              <div className="disk-bar-row" style={{ cursor: "pointer", padding: "6px 0" }} onClick={() => toggleVolume(d.volumeMountPoint)}>
                {/* Volume header line */}
                <div style={{ zIndex: 2, display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 17, fontWeight: 600 }}>{isExpanded ? "▾" : "▸"} {d.volumeMountPoint}</span> {d.volumeName && <span style={{ fontSize: 17, fontWeight: 600, color: "var(--fg-dim)" }}>[{d.volumeName}]</span>}
                  <span style={{ position: "relative", left: 150, fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}><span style={{ marginLeft: "auto", color: "var(--fg-dim)", fontSize: 12 }}>used</span> {formatSize(d.usedMB)} <span style={{ marginLeft: "auto", color: "var(--fg-dim)", fontSize: 12 }}>of</span> {formatSize(d.totalMB)} ({pct}%)</span>
                  <span style={{ fontSize: 16, fontWeight: 600, marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>{formatSize(d.freeMB)} <span style={{ marginLeft: "auto", color: "var(--fg-dim)", fontSize: 12 }}>free</span> ({freePct}%) </span>
                  <button className="btn-sm" style={{ background: "none", border: "none", marginLeft: 4, fontSize: 12, padding: "0px 8px", position: "relative", top: 1 }} onClick={(e) => { e.stopPropagation(); toggleVolume(d.volumeMountPoint); }}>Details &gt;&gt;</button>
                </div>
                <div className="progress-bar" style={{ marginTop: -30 }}><div className="progress-bar-fill" style={{ width: `${pct}%`, background: color }}></div></div>
              </div>
              {isExpanded && (
                <div style={{ paddingLeft: 16, marginTop: 4, marginBottom: 8 }}>
                  {subLoading && <div className="loading">Loading...</div>}
                  {volDbs.map(db => {
                    const dbExpanded = expandedDb === db.databaseName;
                    const dbBarWidth = maxDbSizeMB > 0 ? Math.max(8, (db.totalSizeMB / maxDbSizeMB) * 100) : 100;
                    return (
                      <div key={db.databaseId} style={{ marginBottom: 6 }}>
                        {/* DB bar row — bar on lower z-index, text above */}
                        <div
                          className="db-space-bar"
                          style={{
                            position: "relative",
                            width: `${dbBarWidth}%`,
                            minWidth: 180,
                            height: 26,
                            borderRadius: 3,
                            cursor: "pointer",
                            overflow: "visible",
                          }}
                          onClick={() => toggleDb(db.databaseName)}
                        >
                          {/* Background bar */}
                          <div style={{
                            position: "absolute", inset: 0,
                            background: dbExpanded ? "#333" : "#2a3a4a",
                            borderRadius: 3,
                            zIndex: 0,
                            opacity: dbExpanded ? 0.6 : 1,
                          }}></div>
                          {/* Text/buttons layer */}
                          <div style={{
                            position: "relative", zIndex: 1,
                            display: "flex", alignItems: "center", gap: 6,
                            padding: "0 8px", height: "100%",
                            fontSize: 13,
                          }}>
                            <span style={{ fontSize: 10 }}>{dbExpanded ? "▾" : "▸"}</span>
                            {dbIconSvg()}
                            <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{db.databaseName}</strong>
                            <span style={{ color: "var(--fg-dim)", fontSize: 12 }}>{formatSize(db.totalSizeMB)} in {db.fileCount} file{db.fileCount !== 1 ? "s" : ""}</span>
                            <button className="btn-sm" style={{ marginLeft: "auto", fontSize: 11, padding: "1px 6px" }} onClick={(e) => { e.stopPropagation(); toggleDb(db.databaseName); }}>details</button>
                          </div>
                        </div>
                        {dbExpanded && (
                          <div style={{ paddingLeft: 16 }}>
                            {subLoading && <div className="loading">Loading...</div>}
                            {dbFiles.map(f => {
                              const fileExpanded = expandedFile === f.fileId;
                              const barWidth = maxFileSizeMB > 0 ? Math.max(5, (f.sizeMB / maxFileSizeMB) * 100) : 100;
                              const usedPct = f.sizeMB > 0 ? (f.usedMB / f.sizeMB) * 100 : 0;
                              const freePctFile = f.sizeMB > 0 ? Math.round((f.freeMB / f.sizeMB) * 100) : 0;
                              const isReadOnly = f.filegroupName?.includes("READ_ONLY") ?? false;
                              const fillColor = fileBarColor(f.fileType, isReadOnly);
                              const isData = f.fileType === "ROWS";
                              const isLog = f.fileType === "LOG";
                              const canShrink = !isReadOnly;

                              return (
                                <div key={f.fileId} style={{ marginBottom: 6 }}>
                                  {/* File info line: file_name (filegroup grey) | free of size (percent%) | btn:details (not for logs) | btn:shrink */}
                                  <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
                                    {isData ? (
                                      <span style={{ cursor: "pointer", fontSize: 10 }} onClick={() => toggleFile(f.fileId)}>
                                        {fileExpanded ? "▾" : "▸"}
                                      </span>
                                    ) : <span style={{ width: 12 }}></span>}
                                    <span style={{ minWidth: 160 }}>{f.fileName} <span style={{ color: "var(--fg-dim)" }}>{f.filegroupName || f.fileType}</span></span>
                                    <span style={{ color: "var(--fg-dim)", fontSize: 11, fontVariantNumeric: "tabular-nums" }}>
                                      free {formatSize(f.freeMB)} of {formatSize(f.sizeMB)} ({freePctFile}%)
                                    </span>
                                    {!isLog && (
                                      <button className="btn-sm" style={{ fontSize: 10, padding: "0 4px" }} onClick={(e) => { e.stopPropagation(); toggleFile(f.fileId); }}>details</button>
                                    )}
                                    {canShrink && isLog && (
                                      <button
                                        className="btn-sm"
                                        style={{ fontSize: 10, padding: "0 6px", color: "#5580aa" }}
                                        onClick={(e) => { e.stopPropagation(); requestShrink(db.databaseName, f.fileId, f.fileName, f.fileType); }}
                                        title={`Shrink ${f.fileName}`}
                                      >Shrink</button>
                                    )}
                                  </div>
                                  {/* File bar with hover-shrink for data files */}
                                  <div
                                    className="file-bar-wrap"
                                    style={{ width: `${barWidth}%`, minWidth: 100, height: 18, position: "relative", marginTop: 2, borderRadius: 3, overflow: "visible" }}
                                  >
                                    <div style={{ position: "relative", width: "100%", height: "100%", background: fileFreeColor(), borderRadius: 3, overflow: "hidden" }}>
                                      <div style={{ width: `${usedPct}%`, height: "100%", background: fillColor, borderRadius: 3 }}></div>
                                    </div>
                                    {canShrink && !isLog && (
                                      <button
                                        className="shrink-hover-btn"
                                        style={{
                                          position: "absolute", right: -2, top: 0, height: 18,
                                          background: "rgb(120, 30, 30)",
                                          color: "#fff", border: "none", fontSize: 10, padding: "0 6px",
                                          borderRadius: 3, cursor: "pointer",
                                          display: "none",
                                        }}
                                        onClick={(e) => { e.stopPropagation(); requestShrink(db.databaseName, f.fileId, f.fileName, f.fileType); }}
                                        title={`Shrink ${f.fileName}`}
                                      >Shrink</button>
                                    )}
                                  </div>
                                  {fileExpanded && (
                                    <div style={{ paddingLeft: 24, marginTop: 4 }}>
                                      {subLoading && <div className="loading">Loading...</div>}
                                      {fileObjects.length > 0 ? (
                                        <table className="result-grid" style={{ fontSize: 11 }}>
                                          <thead>
                                            <tr><th>Schema</th><th>Table</th><th>Size MB</th><th>Used MB</th><th>Rows</th></tr>
                                          </thead>
                                          <tbody>
                                            {fileObjects.map((o, i) => (
                                              <tr key={i}>
                                                <td>{o.schemaName}</td>
                                                <td>{o.tableName}</td>
                                                <td className="num">{o.totalSpaceMB}</td>
                                                <td className="num">{o.usedSpaceMB}</td>
                                                <td className="num">{o.rowsCount.toLocaleString()}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      ) : (
                                        <div style={{ color: "var(--fg-dim)", fontSize: 11 }}>No user tables on this file.</div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {volDbs.length === 0 && !subLoading && <div style={{ color: "var(--fg-dim)", fontSize: 11 }}>No databases on this volume.</div>}
                </div>
              )}
            </div>
          );
        })}
        {disks.length === 0 && <div className="loading">No volume info.</div>}
      </div>
    </CollapsiblePanel>
  );
});

/* ==== CPU Section ==== */
const CpuSection = forwardRef<CollapsiblePanelRef, SectionProps>(function CpuSection({ server, onShowSql }, ref) {
  const [info, setInfo] = useState<ServerInfo | null>(null);
  const [cpuHistory, setCpuHistory] = useState<CpuSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const panelRef = useRef<CollapsiblePanelRef>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [infoRes, cpuRes] = await Promise.all([
        bridge.getServerInfo(server),
        bridge.getCpuOverview(server).catch(() => [] as CpuSnapshot[]),
      ]);
      setInfo(infoRes);
      setCpuHistory(cpuRes.reverse());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [server]);

  useImperativeHandle(ref, () => ({
    refresh() { panelRef.current?.refresh(); },
    isCollapsed() { return panelRef.current?.isCollapsed() ?? false; },
  }), []);

  return (
    <CollapsiblePanel ref={panelRef} storageKey={`server:cpu:${server}`} title="CPU" sqlPrefix="cpu" onShowSql={onShowSql} loadData={load} loading={loading} error={error}>
      {info && (
        <div className="server-metrics">
          <div className="server-metric">
            <div className="server-metric-value">{info.cpuCount}</div>
            <div className="server-metric-label">Cores (logical)</div>
          </div>
          <div className="server-metric">
            <div className="server-metric-value">{info.maxDop}</div>
            <div className="server-metric-label">MaxDOP</div>
          </div>
          <div className="server-metric">
            <div className="server-metric-value">{info.costThreshold}</div>
            <div className="server-metric-label">Cost Threshold</div>
          </div>
          <div className="server-metric">
            <div className="server-metric-value">{info.currentCpuPercent ?? 0}%</div>
            <div className="server-metric-label">Current SQL CPU</div>
          </div>
        </div>
      )}
      {cpuHistory.length > 0 && (
        <div className="chart-wrapper" style={{ height: 200, marginTop: 8 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cpuHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="eventTime" tick={{ fill: "var(--fg-dim)", fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fill: "var(--fg-dim)", fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "var(--bg-panel)", border: "1px solid var(--border)" }} />
              <Area type="monotone" dataKey="sqlCpu" stackId="1" stroke="#0e639c" fill="#0e639c" name="SQL CPU %" />
              <Area type="monotone" dataKey="otherCpu" stackId="1" stroke="#f0ad4e" fill="#f0ad4e" name="Other CPU %" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </CollapsiblePanel>
  );
});

/* ==== CPU by Database Section ==== */
const CpuByDbSection = forwardRef<CollapsiblePanelRef, SectionProps>(function CpuByDbSection({ server, onShowSql }, ref) {
  const [cpuByDb, setCpuByDb] = useState<CpuByDatabase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const panelRef = useRef<CollapsiblePanelRef>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setCpuByDb(await bridge.getCpuByDb(server));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [server]);

  useImperativeHandle(ref, () => ({
    refresh() { panelRef.current?.refresh(); },
    isCollapsed() { return panelRef.current?.isCollapsed() ?? false; },
  }), []);

  return (
    <CollapsiblePanel ref={panelRef} storageKey={`server:cpubydb:${server}`} title="CPU by Database" sqlPrefix="cpu-by-db" onShowSql={onShowSql} loadData={load} loading={loading} error={error}>
      {cpuByDb.length > 0 ? (
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cpuByDb.slice(0, 15)}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="databaseName" angle={-30} textAnchor="end" height={70} fontSize={11} tick={{ fill: "var(--fg-dim)" }} />
              <YAxis tick={{ fill: "var(--fg-dim)", fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "var(--bg-panel)", border: "1px solid var(--border)" }} />
              <Bar dataKey="totalCpuMs" fill="#0e639c" name="Total CPU ms" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="loading">No CPU data.</div>
      )}
    </CollapsiblePanel>
  );
});

/* ==== RAM Section ==== */
const RamSection = forwardRef<CollapsiblePanelRef, SectionProps>(function RamSection({ server, onShowSql }, ref) {
  const [ram, setRam] = useState<RamOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const panelRef = useRef<CollapsiblePanelRef>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRam(await bridge.getRamOverview(server));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [server]);

  useImperativeHandle(ref, () => ({
    refresh() { panelRef.current?.refresh(); },
    isCollapsed() { return panelRef.current?.isCollapsed() ?? false; },
  }), []);

  return (
    <CollapsiblePanel ref={panelRef} storageKey={`server:ram:${server}`} title="RAM" sqlPrefix="ram" onShowSql={onShowSql} loadData={load} loading={loading} error={error}>
      {ram && (
        <div className="server-metrics">
          <div className="server-metric">
            <div className="server-metric-value">{ram.physicalMemoryGB.toFixed(1)} GB</div>
            <div className="server-metric-label">Physical RAM</div>
          </div>
          <div className="server-metric">
            <div className="server-metric-value">{ram.sqlUsedMemoryGB.toFixed(1)} GB</div>
            <div className="server-metric-label">SQL Used</div>
          </div>
          <div className="server-metric">
            <div className="server-metric-value">{ram.sqlTargetMemoryGB.toFixed(1)} GB</div>
            <div className="server-metric-label">SQL Target</div>
          </div>
          <div className="server-metric">
            <div className="server-metric-value">{ram.sqlMinMemoryGB.toFixed(1)} / {ram.sqlMaxMemoryGB.toFixed(1)} GB</div>
            <div className="server-metric-label">Min / Max Server Memory</div>
          </div>
          <div className="server-metric">
            <div className="server-metric-value">{ram.committedMemoryGB.toFixed(1)} GB</div>
            <div className="server-metric-label">Committed</div>
          </div>
          <div className="server-metric">
            <div className="server-metric-value">{ram.committedTargetGB.toFixed(1)} GB</div>
            <div className="server-metric-label">Committed Target</div>
          </div>
          <div className="server-metric">
            <div className="server-metric-value">{ram.pageLifeExpectancy}</div>
            <div className="server-metric-label">PLE (sec)</div>
          </div>
          <div className="server-metric">
            <div className="server-metric-value">{ram.bufferCacheHitRatio.toFixed(1)}%</div>
            <div className="server-metric-label">Buffer Cache Hit</div>
          </div>
          <div className="server-metric">
            <div className="server-metric-value">{ram.memoryGrantsPending}</div>
            <div className="server-metric-label">Grants Pending</div>
          </div>
        </div>
      )}
    </CollapsiblePanel>
  );
});

/* ==== Availability Groups Section ==== */
const AvailabilityGroupsSection = forwardRef<CollapsiblePanelRef, SectionProps>(function AvailabilityGroupsSection({ server, onShowSql }, ref) {
  const [groups, setGroups] = useState<AvailabilityGroupInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const panelRef = useRef<CollapsiblePanelRef>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setGroups(await bridge.getAvailabilityGroups(server));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [server]);

  useImperativeHandle(ref, () => ({
    refresh() { panelRef.current?.refresh(); },
    isCollapsed() { return panelRef.current?.isCollapsed() ?? false; },
  }), []);

  // Group by AG name
  const agMap = new Map<string, AvailabilityGroupInfo[]>();
  for (const g of groups) {
    const arr = agMap.get(g.agName) || [];
    arr.push(g);
    agMap.set(g.agName, arr);
  }

  return (
    <CollapsiblePanel ref={panelRef} storageKey={`server:ag:${server}`} title="Availability Groups" sqlPrefix="availability" onShowSql={onShowSql} loadData={load} loading={loading} error={error}>
      {groups.length === 0 && !loading && <div className="loading">No availability groups configured (or HADR not enabled).</div>}
      {Array.from(agMap.entries()).map(([agName, dbs]) => {
        const first = dbs[0];
        return (
          <div key={agName} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <strong>{agName}</strong>
              <span className={first.synchronizationHealth === "HEALTHY" ? "text-success" : "text-danger"}>
                {first.synchronizationHealth}
              </span>
              <span style={{ fontSize: 11, color: "var(--fg-dim)" }}>Primary: {first.primaryReplica}</span>
            </div>
            <table className="result-grid">
              <thead>
                <tr><th>Database</th><th>State</th><th>Sync State</th><th>Replica</th><th>Role</th><th>Mode</th><th>Failover</th></tr>
              </thead>
              <tbody>
                {dbs.map((d, i) => (
                  <tr key={i}>
                    <td>{d.databaseName}</td>
                    <td className={d.databaseState === "ONLINE" ? "text-success" : "text-danger"}>{d.databaseState}</td>
                    <td>{d.synchronizationState}</td>
                    <td>{d.replicaServerName}{d.isLocal ? " *" : ""}</td>
                    <td>{d.replicaRole}</td>
                    <td>{d.availabilityMode}</td>
                    <td>{d.failoverMode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </CollapsiblePanel>
  );
});

/* ==== Services Section ==== */
const ServicesSection = forwardRef<CollapsiblePanelRef, SectionProps>(function ServicesSection({ server, onShowSql }, ref) {
  const [services, setServices] = useState<ServerService[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const panelRef = useRef<CollapsiblePanelRef>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setServices(await bridge.getServerServices(server));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [server]);

  useImperativeHandle(ref, () => ({
    refresh() { panelRef.current?.refresh(); },
    isCollapsed() { return panelRef.current?.isCollapsed() ?? false; },
  }), []);

  return (
    <CollapsiblePanel ref={panelRef} storageKey={`server:services:${server}`} title="Services" sqlPrefix="server-service" onShowSql={onShowSql} loadData={load} loading={loading} error={error}>
      <table className="result-grid">
        <thead>
          <tr><th>Service</th><th>Status</th><th>Startup</th><th>Last Startup</th><th>Account</th></tr>
        </thead>
        <tbody>
          {services.map((s) => (
            <tr key={s.serviceName}>
              <td>{s.serviceName}</td>
              <td className={s.status === "Running" ? "text-success" : "text-danger"}>{s.status}</td>
              <td>{s.startupType}</td>
              <td>{s.lastStartupTime ?? "—"}</td>
              <td>{s.serviceAccount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </CollapsiblePanel>
  );
});

/* ==== Configuration Section ==== */
type CfgSortKey = "name" | "configValue" | "runValue" | "minimum" | "maximum" | "mismatch";
type SortDir = "asc" | "desc";

const ConfigSection = forwardRef<CollapsiblePanelRef, SectionProps>(function ConfigSection({ server, onShowSql }, ref) {
  const [config, setConfig] = useState<ServerConfigOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<CfgSortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const panelRef = useRef<CollapsiblePanelRef>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setConfig(await bridge.getServerConfig(server));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [server]);

  useImperativeHandle(ref, () => ({
    refresh() { panelRef.current?.refresh(); },
    isCollapsed() { return panelRef.current?.isCollapsed() ?? false; },
  }), []);

  function handleSort(key: CfgSortKey) {
    if (sortKey === key) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const lc = filter.toLowerCase();
  const filtered = useMemo(() => {
    let result = lc ? config.filter((c) => c.name.toLowerCase().includes(lc)) : config;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...result].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
      if (sortKey === "mismatch") {
        const am = a.configValue !== a.runValue ? 1 : 0;
        const bm = b.configValue !== b.runValue ? 1 : 0;
        return (am - bm) * dir;
      }
      return ((a[sortKey] as number) - (b[sortKey] as number)) * dir;
    });
  }, [config, lc, sortKey, sortDir]);

  function sortIndicator(key: CfgSortKey) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  return (
    <CollapsiblePanel ref={panelRef} storageKey={`server:config:${server}`} title={`Configuration (${config.length})`} sqlPrefix="server-config" onShowSql={onShowSql} loadData={load} loading={loading} error={error}>
      <div style={{ padding: "4px 8px" }}>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter options..."
          style={{ width: "100%" }}
        />
      </div>
      <div className="activity-grid-wrap" style={{ maxHeight: 400 }}>
        <table className="result-grid activity-grid">
          <thead>
            <tr>
              <th className="sortable" onClick={() => handleSort("name")}>Option{sortIndicator("name")}</th>
              <th className="sortable" onClick={() => handleSort("configValue")}>Config Value{sortIndicator("configValue")}</th>
              <th className="sortable" onClick={() => handleSort("runValue")}>Run Value{sortIndicator("runValue")}</th>
              <th className="sortable" onClick={() => handleSort("minimum")}>Min{sortIndicator("minimum")}</th>
              <th className="sortable" onClick={() => handleSort("maximum")}>Max{sortIndicator("maximum")}</th>
              <th className="sortable" onClick={() => handleSort("mismatch")}>Mismatch{sortIndicator("mismatch")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const mismatch = c.configValue !== c.runValue;
              return (
                <tr key={c.name} className={mismatch ? "row-blocked" : ""}>
                  <td>{c.name}</td>
                  <td className="num">{c.configValue}</td>
                  <td className="num">{c.runValue}</td>
                  <td className="num">{c.minimum}</td>
                  <td className="num">{c.maximum}</td>
                  <td>{mismatch ? "⚠ Restart needed" : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </CollapsiblePanel>
  );
});
