import { useState, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { bridge } from "../bridge";
import { CollapsiblePanel, CollapsiblePanelRef } from "./CollapsiblePanel";
import type { ServerInfo, VolumeSpaceInfo, ServerService, RamOverview, DatabaseOverviewInfo, AvailabilityGroupInfo, CmdResult, ServerConfigOption, CpuSnapshot } from "../../shared/types";

interface Props {
  server: string;
  onShowSql?: (prefix: string) => void;
}

export function ServerPanel({ server, onShowSql }: Props) {
  const cpuRef = useRef<CollapsiblePanelRef>(null);
  const ramRef = useRef<CollapsiblePanelRef>(null);
  const dbSizesRef = useRef<CollapsiblePanelRef>(null);
  const diskRef = useRef<CollapsiblePanelRef>(null);
  const agRef = useRef<CollapsiblePanelRef>(null);
  const svcRef = useRef<CollapsiblePanelRef>(null);
  const cfgRef = useRef<CollapsiblePanelRef>(null);

  function refreshAll() {
    cpuRef.current?.refresh();
    ramRef.current?.refresh();
    dbSizesRef.current?.refresh();
    diskRef.current?.refresh();
    agRef.current?.refresh();
    svcRef.current?.refresh();
    cfgRef.current?.refresh();
  }

  return (
    <div className="page-panel">
      <div className="page-header">
        <h3>Server — {server}</h3>
        <button onClick={refreshAll}>Refresh</button>
      </div>

      <ActionsSection server={server} />
      <CpuSection ref={cpuRef} server={server} onShowSql={onShowSql} />
      <RamSection ref={ramRef} server={server} onShowSql={onShowSql} />
      <DatabasesSection ref={dbSizesRef} server={server} onShowSql={onShowSql} />
      <DiskSection ref={diskRef} server={server} onShowSql={onShowSql} />
      <AvailabilityGroupsSection ref={agRef} server={server} onShowSql={onShowSql} />
      <ServicesSection ref={svcRef} server={server} onShowSql={onShowSql} />
      <ConfigSection ref={cfgRef} server={server} onShowSql={onShowSql} />
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
        <div className="cpanel-body" style={{ display: "flex", gap: 8, padding: "8px 10px" }}>
          <button onClick={() => openModal("db")}>Create Database</button>
          <button onClick={() => openModal("login")}>Create Login</button>
          <button onClick={() => openModal("grant")}>Grant Permission</button>
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

/* ==== Databases Section (rich list) ==== */
const DatabasesSection = forwardRef<CollapsiblePanelRef, SectionProps>(function DatabasesSection({ server, onShowSql }, ref) {
  const [dbs, setDbs] = useState<DatabaseOverviewInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [addName, setAddName] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addResult, setAddResult] = useState<CmdResult | null>(null);
  const panelRef = useRef<CollapsiblePanelRef>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setDbs(await bridge.getDatabaseOverview(server));
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

  function toggleDetail(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleAdd() {
    const name = addName.trim();
    if (!name) return;
    setAddBusy(true);
    setAddResult(null);
    try {
      const res = await bridge.createDatabase(server, name);
      setAddResult(res);
      if (res.success) { setAddName(""); panelRef.current?.refresh(); }
    } catch (e: unknown) {
      setAddResult({ success: false, message: e instanceof Error ? e.message : String(e) });
    } finally {
      setAddBusy(false);
    }
  }

  const lc = filter.toLowerCase();
  const filtered = lc ? dbs.filter((d) => d.databaseName.toLowerCase().includes(lc)) : dbs;

  function fmtMB(v: number | null): string {
    if (v == null) return "—";
    if (v >= 1024) return `${(v / 1024).toFixed(2)} GB`;
    return `${v.toFixed(1)} MB`;
  }

  return (
    <CollapsiblePanel ref={panelRef} storageKey={`server:dbs:${server}`} title={`Databases (${filtered.length}/${dbs.length})`} sqlPrefix="database" onShowSql={onShowSql} loadData={load} loading={loading} error={error}>
      {/* Add database row */}
      <div className="db-add-row">
        <input
          value={addName}
          onChange={(e) => setAddName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          placeholder="New database name"
          disabled={addBusy}
          style={{ flex: 1 }}
        />
        <button onClick={handleAdd} disabled={addBusy || !addName.trim()}>Add</button>
      </div>
      {addResult && <div className={addResult.success ? "success-msg" : "error-msg"} style={{ fontSize: 11, padding: "2px 8px" }}>{addResult.message}</div>}

      {/* Filter */}
      <div style={{ padding: "4px 8px" }}>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter databases..."
          style={{ width: "100%" }}
        />
      </div>

      {/* Database list */}
      <DbCardList dbs={filtered} expanded={expanded} onToggle={toggleDetail} fmtMB={fmtMB} loading={loading} />
    </CollapsiblePanel>
  );
});

/* ---- DB color helpers ---- */
const SYSTEM_DBS = new Set(["master", "tempdb", "model", "msdb"]);

function isSystemDb(name: string): boolean {
  return SYSTEM_DBS.has(name.toLowerCase());
}

function dbIconColor(d: DatabaseOverviewInfo): string {
  const name = d.databaseName.toLowerCase();
  if (isSystemDb(name)) return "#f0ad4e"; // orange
  const st = d.stateDesc.toUpperCase();
  if (st === "OFFLINE") return "#888";  // gray
  if (st === "SUSPECT" || st === "EMERGENCY" || st === "RECOVERY_PENDING") return "#d9534f"; // red
  if (st === "RESTORING" || st === "RECOVERING") return "#5cb85c"; // green
  return "#f0c674"; // yellow — online (default)
}

function dbNameColor(d: DatabaseOverviewInfo): string {
  const name = d.databaseName.toLowerCase();
  if (isSystemDb(name)) {
    if (name === "master" || name === "msdb") return "#f0ad4e"; // orange
    if (name === "tempdb") return "#888"; // gray
    return "inherit"; // model — white
  }
  const st = d.stateDesc.toUpperCase();
  if (st === "OFFLINE" || st === "RESTORING" || st === "RECOVERING") return "#888"; // gray
  if (st === "SUSPECT" || st === "EMERGENCY" || st === "RECOVERY_PENDING") return "#d9534f"; // red
  if (d.agName && st === "ONLINE") return "#5cb85c"; // green — AG online OK
  return "inherit"; // white — online, no AG
}

/* ---- Grouped DB card list ---- */
function DbCardList({ dbs, expanded, onToggle, fmtMB, loading }: {
  dbs: DatabaseOverviewInfo[];
  expanded: Set<number>;
  onToggle: (id: number) => void;
  fmtMB: (v: number | null) => string;
  loading: boolean;
}) {
  const [sysOpen, setSysOpen] = useState(false);
  const userDbs = dbs.filter((d) => !isSystemDb(d.databaseName));
  const sysDbs = dbs.filter((d) => isSystemDb(d.databaseName));

  function renderCard(d: DatabaseOverviewInfo) {
    const isOpen = expanded.has(d.databaseId);
    const iconClr = dbIconColor(d);
    return (
      <div key={d.databaseId} className="db-card">
        <div className="db-card-header" onClick={() => onToggle(d.databaseId)}>
          <span className="db-card-name">
            <span style={{ fontSize: 10, marginRight: 4 }}>{isOpen ? "▾" : "▸"}</span>
            <svg className="db-icon" viewBox="0 0 16 16" fill={iconClr}><ellipse cx="8" cy="3.5" rx="6" ry="2.5"/><path d="M2 3.5v9c0 1.38 2.69 2.5 6 2.5s6-1.12 6-2.5v-9" fill="none" stroke={iconClr} strokeWidth="1.2"/><path d="M2 8c0 1.38 2.69 2.5 6 2.5s6-1.12 6-2.5" fill="none" stroke={iconClr} strokeWidth="1.2"/></svg>
            <span style={{ color: dbNameColor(d) }}>{d.databaseName}</span>
          </span>
          {d.agSyncState && <span className="db-card-badge badge-info"> ({d.agSyncState})</span>}
          {d.stateDesc !== "ONLINE" && (
            <span className={`db-card-badge ${d.stateDesc === "RESTORING" || d.stateDesc === "RECOVERING" ? "badge-muted" : "badge-danger"}`}>{d.stateDesc}</span>
          )}
          
        </div>
        <div className="db-card-metrics">
          <span>Data: <b>{fmtMB(d.dataSizeMB)}</b></span>
          <span>Log: <b>{fmtMB(d.logSizeMB)}</b></span>
          <span>Log free: <b>{fmtMB(d.logFreeSpaceMB)}</b></span>
          <span>Log reuse: <b>{d.logReuseWaitDesc}</b></span>
        </div>
        {isOpen && (
          <div className="db-card-details">
            <div className="db-detail-grid">
              <span>Data files: <b>{d.dataFileCount}</b></span>
              <span>Log files: <b>{d.logFileCount}</b></span>
              <span>Owner: <b>{d.dbOwner}</b></span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="db-list">
      {userDbs.map(renderCard)}
      {sysDbs.length > 0 && (
        <div className="db-system-group">
          <div className="db-system-header" onClick={() => setSysOpen((v) => !v)}>
            <span style={{ fontSize: 10, marginRight: 4 }}>{sysOpen ? "▾" : "▸"}</span>
            System Databases ({sysDbs.length})
          </div>
          {sysOpen && sysDbs.map(renderCard)}
        </div>
      )}
      {dbs.length === 0 && !loading && <div className="loading">No databases found.</div>}
    </div>
  );
}

/* ==== Disks Section ==== */
const DiskSection = forwardRef<CollapsiblePanelRef, SectionProps>(function DiskSection({ server, onShowSql }, ref) {
  const [disks, setDisks] = useState<VolumeSpaceInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const panelRef = useRef<CollapsiblePanelRef>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setDisks(await bridge.getVolumes(server));
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
    <CollapsiblePanel ref={panelRef} storageKey={`server:disks:${server}`} title="Disks" sqlPrefix="volume" onShowSql={onShowSql} loadData={load} loading={loading} error={error}>
      <div className="disk-bars">
        {disks.map((d) => {
          const pct = d.totalMB > 0 ? Math.round((d.usedMB / d.totalMB) * 100) : 0;
          const color = pct > 90 ? "var(--danger)" : pct > 75 ? "#f0ad4e" : "var(--accent)";
          return (
            <div key={d.volumeMountPoint} className="disk-bar-row">
              <div className="disk-bar-label">
                <span>{d.volumeMountPoint}</span>
                {d.volumeName && <span style={{ color: "var(--fg-dim)" }}> ({d.volumeName})</span>}
                <span style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>
                  {(d.usedMB / 1024).toFixed(1)} / {(d.totalMB / 1024).toFixed(1)} GB ({pct}%)
                </span>
              </div>
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${pct}%`, background: color }} />
              </div>
            </div>
          );
        })}
        {disks.length === 0 && <div className="loading">No volume info.</div>}
      </div>
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
const ConfigSection = forwardRef<CollapsiblePanelRef, SectionProps>(function ConfigSection({ server, onShowSql }, ref) {
  const [config, setConfig] = useState<ServerConfigOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
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

  const lc = filter.toLowerCase();
  const filtered = lc ? config.filter((c) => c.name.toLowerCase().includes(lc)) : config;

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
        <table className="result-grid">
          <thead>
            <tr>
              <th>Option</th>
              <th>Config Value</th>
              <th>Run Value</th>
              <th>Min</th>
              <th>Max</th>
              <th>Mismatch</th>
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
