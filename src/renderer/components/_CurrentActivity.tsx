import { useState, useEffect, useRef, useCallback } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { bridge } from "../bridge";
import type {
  SessionInfo,
  SessionDetail,
  CpuSnapshot,
  WaitStatInfo,
  BlockingProcess,
} from "../../shared/types";

const REFRESH_OPTIONS = [3, 5, 10, 15, 30, 60];

type SortKey = "cpuTime" | "reads" | "writes" | "logicalReads" | "waitTime";

interface Props {
  server: string;
}

export function CurrentActivity({ server }: Props) {
  /* ---- state ---- */
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [cpuHistory, setCpuHistory] = useState<CpuSnapshot[]>([]);
  const [waits, setWaits] = useState<WaitStatInfo[]>([]);
  const [blocking, setBlocking] = useState<BlockingProcess[]>([]);
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("cpuTime");
  const [sortAsc, setSortAsc] = useState(false);
  const [interval, setInterval_] = useState(30);
  const [loading, setLoading] = useState(false);

  // Session detail
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Kill
  const [killTarget, setKillTarget] = useState<number | null>(null);
  const [killConfirm, setKillConfirm] = useState("");
  const [killMsg, setKillMsg] = useState("");

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  /* ---- data fetch ---- */
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [sess, cpu, w, bl] = await Promise.all([
        bridge.getSessions(server),
        bridge.getCpuOverview(server),
        bridge.getWaitStats(server),
        bridge.getBlocking(server),
      ]);
      if (!mountedRef.current) return;
      setSessions(sess);
      setCpuHistory(cpu.reverse());
      setWaits(w);
      setBlocking(bl);
    } catch {
      /* ignore refresh errors */
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [server]);

  /* ---- auto-refresh loop ---- */
  useEffect(() => {
    mountedRef.current = true;
    refresh();

    function schedule() {
      timerRef.current = setTimeout(async () => {
        if (!mountedRef.current) return;
        await refresh();
        if (mountedRef.current) schedule();
      }, interval * 1000);
    }
    schedule();

    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [server, interval, refresh]);

  /* ---- fetch session detail ---- */
  async function loadDetail(sid: number) {
    if (detailId === sid) { setDetailId(null); setDetail(null); return; }
    setDetailId(sid);
    setDetail(null);
    setDetailLoading(true);
    try {
      const d = await bridge.getSessionDetail(server, sid);
      if (mountedRef.current) setDetail(d);
    } finally {
      if (mountedRef.current) setDetailLoading(false);
    }
  }

  /* ---- kill session ---- */
  async function handleKill() {
    if (killTarget == null) return;
    if (killConfirm !== String(killTarget)) {
      setKillMsg(`Type ${killTarget} to confirm.`);
      return;
    }
    const res = await bridge.killSession(server, killTarget);
    setKillMsg(res.message);
    if (res.success) {
      setKillTarget(null);
      setKillConfirm("");
      refresh();
    }
  }

  /* ---- filter + sort ---- */
  const lc = filter.toLowerCase();
  const filtered = sessions.filter((s) => {
    if (!lc) return true;
    return (
      String(s.sessionId).includes(lc) ||
      s.loginName.toLowerCase().includes(lc) ||
      s.hostName.toLowerCase().includes(lc) ||
      s.programName.toLowerCase().includes(lc) ||
      s.command.toLowerCase().includes(lc) ||
      (s.databaseName ?? "").toLowerCase().includes(lc) ||
      (s.currentStatement ?? "").toLowerCase().includes(lc)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey] ?? 0;
    const bv = b[sortKey] ?? 0;
    return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(false); }
  }

  const sortArrow = (key: SortKey) =>
    sortKey === key ? (sortAsc ? " ▲" : " ▼") : "";

  /* ---- blocking tree builder ---- */
  interface BlockNode extends BlockingProcess {
    children: BlockNode[];
  }

  function buildBlockingTree(rows: BlockingProcess[]): BlockNode[] {
    const map = new Map<number, BlockNode>();
    const roots: BlockNode[] = [];

    // collect all session IDs that are blocked
    const blockedIds = new Set(rows.map((r) => r.sessionId));

    for (const r of rows) {
      map.set(r.sessionId, { ...r, children: [] });
    }
    for (const node of map.values()) {
      if (node.blockingSessionId && map.has(node.blockingSessionId)) {
        map.get(node.blockingSessionId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  function renderBlockNode(node: BlockNode, depth: number): React.ReactNode {
    return (
      <div key={node.sessionId} style={{ paddingLeft: depth * 16 }}>
        <div className="block-row">
          <span className="block-sid">{node.sessionId}</span>
          {node.blockingSessionId > 0 && (
            <span className="block-arrow"> ← blocked by {node.blockingSessionId}</span>
          )}
          <span className="block-info">
            {" "}{node.status} | {node.waitType} ({node.waitTimeMs}ms) | {node.databaseName}
          </span>
        </div>
        {node.currentStatement && (
          <div className="block-stmt" style={{ paddingLeft: depth * 16 + 16 }}>
            {node.currentStatement}
          </div>
        )}
        {node.children.map((c) => renderBlockNode(c, depth + 1))}
      </div>
    );
  }

  /* ---- render ---- */
  return (
    <div className="activity-panel">
      {/* Header bar */}
      <div className="activity-header">
        <h3>⚡ Current Activity — {server}</h3>
        <div className="activity-controls">
          <span style={{ fontSize: 11, color: "var(--fg-dim)" }}>Refresh:</span>
          <select value={interval} onChange={(e) => setInterval_(Number(e.target.value))}>
            {REFRESH_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}s</option>
            ))}
          </select>
          <button onClick={refresh} disabled={loading}>
            {loading ? "..." : "⟳ Now"}
          </button>
        </div>
      </div>

      {/* ---- Sessions grid ---- */}
      <div className="activity-section">
        <div className="activity-section-header">
          <strong>Sessions ({filtered.length})</strong>
          <input
            className="activity-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter (login, host, command, query...)"
          />
        </div>
        <div className="activity-grid-wrap">
          <table className="result-grid activity-grid">
            <thead>
              <tr>
                <th>SID</th>
                <th>Login</th>
                <th>Host</th>
                <th>DB</th>
                <th>Status</th>
                <th>Command</th>
                <th className="sortable" onClick={() => toggleSort("cpuTime")}>CPU{sortArrow("cpuTime")}</th>
                <th className="sortable" onClick={() => toggleSort("reads")}>Reads{sortArrow("reads")}</th>
                <th className="sortable" onClick={() => toggleSort("writes")}>Writes{sortArrow("writes")}</th>
                <th className="sortable" onClick={() => toggleSort("logicalReads")}>Logical R{sortArrow("logicalReads")}</th>
                <th className="sortable" onClick={() => toggleSort("waitTime")}>Wait ms{sortArrow("waitTime")}</th>
                <th>Wait Type</th>
                <th>Blk By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <tr key={s.sessionId} className={s.blockingSessionId > 0 ? "row-blocked" : ""}>
                  <td>{s.sessionId}</td>
                  <td>{s.loginName}</td>
                  <td>{s.hostName}</td>
                  <td>{s.databaseName}</td>
                  <td>{s.status}</td>
                  <td>{s.command}</td>
                  <td className="num">{s.cpuTime}</td>
                  <td className="num">{s.reads}</td>
                  <td className="num">{s.writes}</td>
                  <td className="num">{s.logicalReads}</td>
                  <td className="num">{s.waitTime}</td>
                  <td>{s.waitType ?? ""}</td>
                  <td className="num">{s.blockingSessionId > 0 ? s.blockingSessionId : ""}</td>
                  <td>
                    <button
                      className="btn-sm"
                      onClick={() => loadDetail(s.sessionId)}
                      title="Query + Plan"
                    >
                      📄
                    </button>
                    <button
                      className="btn-sm danger"
                      onClick={() => { setKillTarget(s.sessionId); setKillConfirm(""); setKillMsg(""); }}
                      title="Kill session"
                    >
                      Kill
                    </button>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr><td colSpan={14} style={{ textAlign: "center", color: "var(--fg-dim)" }}>No sessions</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- Session detail (query + plan) ---- */}
      {detailId != null && (
        <div className="activity-section activity-detail">
          <div className="activity-section-header">
            <strong>Session {detailId} — Query &amp; Plan</strong>
            <button className="btn-sm" onClick={() => { setDetailId(null); setDetail(null); }}>Close</button>
          </div>
          {detailLoading && <div className="loading">Loading...</div>}
          {!detailLoading && detail && (
            <>
              <div className="detail-block">
                <label>Query Text:</label>
                <pre className="detail-code">{detail.queryText}</pre>
              </div>
              {detail.queryPlan && (
                <div className="detail-block">
                  <label>Execution Plan (XML):</label>
                  <pre className="detail-code detail-plan">{detail.queryPlan}</pre>
                </div>
              )}
            </>
          )}
          {!detailLoading && !detail && (
            <div className="loading">No active request for this session (idle or completed).</div>
          )}
        </div>
      )}

      {/* ---- Kill confirmation dialog ---- */}
      {killTarget != null && (
        <div className="activity-section activity-kill">
          <div className="activity-section-header">
            <strong>Kill Session {killTarget}</strong>
            <button className="btn-sm" onClick={() => { setKillTarget(null); setKillMsg(""); }}>Cancel</button>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0" }}>
            <span>Type session ID to confirm:</span>
            <input
              value={killConfirm}
              onChange={(e) => setKillConfirm(e.target.value)}
              placeholder={String(killTarget)}
              style={{ width: 80 }}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleKill(); }}
            />
            <button className="danger" onClick={handleKill}>Kill</button>
          </div>
          {killMsg && <div className={killMsg.startsWith("Session") ? "success-msg" : "error-msg"}>{killMsg}</div>}
        </div>
      )}

      {/* ---- Blocking tree ---- */}
      <div className="activity-section">
        <div className="activity-section-header">
          <strong>Blocking Tree ({blocking.length})</strong>
        </div>
        {blocking.length === 0 ? (
          <div className="loading">No blocking detected.</div>
        ) : (
          <div className="blocking-tree">
            {buildBlockingTree(blocking).map((n) => renderBlockNode(n, 0))}
          </div>
        )}
      </div>

      {/* ---- Wait Stats ---- */}
      <div className="activity-section">
        <div className="activity-section-header">
          <strong>Wait Stats (Top 20)</strong>
        </div>
        <div className="activity-grid-wrap">
          <table className="result-grid">
            <thead>
              <tr>
                <th>Wait Type</th>
                <th>Count</th>
                <th>Wait ms</th>
                <th>Signal ms</th>
                <th>Resource ms</th>
              </tr>
            </thead>
            <tbody>
              {waits.map((w) => (
                <tr key={w.waitType}>
                  <td>{w.waitType}</td>
                  <td className="num">{w.waitCount.toLocaleString()}</td>
                  <td className="num">{w.waitTimeMs.toLocaleString()}</td>
                  <td className="num">{w.signalWaitMs.toLocaleString()}</td>
                  <td className="num">{w.resourceWaitMs.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- CPU history chart ---- */}
      <div className="activity-section">
        <div className="activity-section-header">
          <strong>CPU — Last 30 min</strong>
        </div>
        <div className="chart-wrapper" style={{ height: 220 }}>
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
      </div>
    </div>
  );
}
