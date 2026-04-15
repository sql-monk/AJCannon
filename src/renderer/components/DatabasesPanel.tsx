import { useState, useCallback, useEffect } from "react";
import { bridge } from "../bridge";
import { PageHeader } from "./PageHeader";
import type { DatabaseOverviewInfo } from "../../shared/types";

interface Props {
  server: string;
}

/* ---- DB color helpers ---- */
const SYSTEM_DBS = new Set(["master", "tempdb", "model", "msdb"]);

function isSystemDb(name: string): boolean {
  return SYSTEM_DBS.has(name.toLowerCase());
}

function dbIconColor(d: DatabaseOverviewInfo): string {
  const name = d.databaseName.toLowerCase();
  if (isSystemDb(name)) return "#f0ad4e";
  const st = d.stateDesc.toUpperCase();
  if (st === "OFFLINE") return "#888";
  if (st === "SUSPECT" || st === "EMERGENCY" || st === "RECOVERY_PENDING") return "#d9534f";
  if (st === "RESTORING" || st === "RECOVERING") return "#5cb85c";
  return "#f0c674";
}

function dbNameColor(d: DatabaseOverviewInfo): string {
  const name = d.databaseName.toLowerCase();
  if (isSystemDb(name)) {
    if (name === "master" || name === "msdb") return "#f0ad4e";
    if (name === "tempdb") return "#888";
    return "inherit";
  }
  const st = d.stateDesc.toUpperCase();
  if (st === "OFFLINE" || st === "RESTORING" || st === "RECOVERING") return "#888";
  if (st === "SUSPECT" || st === "EMERGENCY" || st === "RECOVERY_PENDING") return "#d9534f";
  if (d.agName && st === "ONLINE") return "#5cb85c";
  return "inherit";
}

function fmtMB(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1024) return `${(v / 1024).toFixed(2)} GB`;
  return `${v.toFixed(1)} MB`;
}

export function DatabasesPanel({ server }: Props) {
  const [dbs, setDbs] = useState<DatabaseOverviewInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setDbs(await bridge.getDatabaseOverview(server));
    } catch { /* ignore */ }
    setLoading(false);
  }, [server]);

  useEffect(() => { refresh(); }, [refresh]);

  function toggleDetail(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const lc = filter.toLowerCase();
  const filtered = lc ? dbs.filter((d) => d.databaseName.toLowerCase().includes(lc)) : dbs;

  /* Split system / user, system first */
  const sysDbs = filtered.filter((d) => isSystemDb(d.databaseName));
  const userDbs = filtered.filter((d) => !isSystemDb(d.databaseName));

  function renderCard(d: DatabaseOverviewInfo) {
    const isOpen = expanded.has(d.databaseId);
    const iconClr = dbIconColor(d);
    return (
      <div key={d.databaseId} className="db-card">
        <div className="db-card-header" onClick={() => toggleDetail(d.databaseId)}>
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
    <div className="page-panel">
      <PageHeader
        icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 6c0-1.1 4-3 9-3s9 1.9 9 3v12c0 1.1-4 3-9 3s-9-1.9-9-3V6z"/><path d="M3 6c0 1.1 4 3 9 3s9-1.9 9-3"/><path d="M3 12c0 1.1 4 3 9 3s9-1.9 9-3"/></svg>}
        title={`Databases (${filtered.length}/${dbs.length})`}
        server={server}
        pageColor="#4a3a2a"
        onRefresh={refresh}
        loading={loading}
      />

      <div style={{ padding: "4px 8px" }}>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter databases..."
          style={{ width: "100%" }}
        />
      </div>

      <div className="db-list">
        {sysDbs.map(renderCard)}
        {userDbs.map(renderCard)}
        {dbs.length === 0 && !loading && <div className="loading">No databases found.</div>}
      </div>
    </div>
  );
}
