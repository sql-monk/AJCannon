import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import hljs from "highlight.js/lib/core";
import sql from "highlight.js/lib/languages/sql";
import xml from "highlight.js/lib/languages/xml";
import "highlight.js/styles/vs2015.css";
import { PageHeader } from "./PageHeader";
import { bridge } from "../bridge";
import type {
  SessionInfo,
  SessionDetail,
  BlockingProcess,
  ExpensiveQuery,
} from "../../shared/types";

hljs.registerLanguage("sql", sql);
hljs.registerLanguage("xml", xml);

const REFRESH_OPTIONS = [3, 5, 10, 15, 30, 60];
type SortKey = "cpuTime" | "reads" | "writes" | "logicalReads" | "waitTime";
type ExpSortKey = "executionCount" | "totalCpuMs" | "avgCpuMs" | "totalReads" | "avgReads" | "totalDurationMs" | "avgDurationMs" | "lastExecutionTime";

interface Props { server: string; onError?: (msg: string) => void; onShowSql?: (prefix: string) => void; }

export function ActivityPanel({ server, onError, onShowSql }: Props) {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [blocking, setBlocking] = useState<BlockingProcess[]>([]);
  const [expensive, setExpensive] = useState<ExpensiveQuery[]>([]);
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("cpuTime");
  const [sortAsc, setSortAsc] = useState(false);
  const [interval, setInterval_] = useState(30);
  const [loading, setLoading] = useState(false);

  /* Per-section error state */
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({});

  /* Status multi-select filter */
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());

  /* Quick filter: blocked / blocking */
  const [quickFilter, setQuickFilter] = useState<"blocked" | "blocking" | null>(null);

  /* Expanded rows in active requests (inline query display) */
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [rowDetails, setRowDetails] = useState<Map<number, SessionDetail | null>>(new Map());
  const [rowDetailLoading, setRowDetailLoading] = useState<Set<number>>(new Set());

  /* Plan viewer modal */
  const [planModal, setPlanModal] = useState<{ title: string; xml: string } | null>(null);

  const [killTarget, setKillTarget] = useState<SessionInfo | BlockingProcess | null>(null);
  const [killConfirm, setKillConfirm] = useState("");
  const [killMsg, setKillMsg] = useState("");

  /* Blocking tree expand/detail state */
  const [blockExpanded, setBlockExpanded] = useState<Set<number>>(new Set());
  const [blockDetail, setBlockDetail] = useState<{ spid: number; type: "sql" | "plan" } | null>(null);

  /* Expensive queries: expandable row + sort */
  const [expSortKey, setExpSortKey] = useState<ExpSortKey>("totalCpuMs");
  const [expSortAsc, setExpSortAsc] = useState(false);
  const [expandedExp, setExpandedExp] = useState<Set<number>>(new Set());

  /* Collapsible sections — persisted via localStorage */
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem("AJCannon:collapsed:activity") || "{}"); }
    catch { return {}; }
  });
  function toggleCollapse(key: string) {
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem("AJCannon:collapsed:activity", JSON.stringify(next));
      return next;
    });
  }

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const errors: Record<string, string> = {};

    const [sessResult, blResult, expResult] = await Promise.all([
      bridge.getSessions(server).catch((e: unknown) => { errors.requests = e instanceof Error ? e.message : String(e); return null; }),
      bridge.getBlocking(server).catch((e: unknown) => { errors.blocking = e instanceof Error ? e.message : String(e); return null; }),
      bridge.getExpensiveQueries(server).catch((e: unknown) => { errors.expensive = e instanceof Error ? e.message : String(e); return null; }),
    ]);

    if (!mountedRef.current) return;
    if (sessResult !== null) setSessions(sessResult);
    if (blResult !== null) setBlocking(blResult);
    if (expResult !== null) setExpensive(expResult);
    setSectionErrors(errors);
    setLoading(false);
  }, [server]);

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
    return () => { mountedRef.current = false; if (timerRef.current) clearTimeout(timerRef.current); };
  }, [server, interval, refresh]);

  /* Toggle row expansion for active requests */
  async function toggleRowExpand(sid: number) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) { next.delete(sid); } else { next.add(sid); }
      return next;
    });
    if (!rowDetails.has(sid) && !rowDetailLoading.has(sid)) {
      setRowDetailLoading((prev) => new Set(prev).add(sid));
      try {
        const d = await bridge.getSessionDetail(server, sid);
        if (mountedRef.current) setRowDetails((prev) => new Map(prev).set(sid, d));
      } catch (err: unknown) {
        if (onError) onError(err instanceof Error ? err.message : String(err));
      } finally {
        if (mountedRef.current) setRowDetailLoading((prev) => { const n = new Set(prev); n.delete(sid); return n; });
      }
    }
  }

  /* Open plan XML in modal */
  function openPlanModal(title: string, xmlText: string) {
    setPlanModal({ title, xml: xmlText });
  }

  function openKill(e: React.MouseEvent, row: SessionInfo | BlockingProcess) {
    e.stopPropagation();
    setKillTarget(row); setKillConfirm(""); setKillMsg("");
  }

  async function handleKill() {
    if (!killTarget) return;
    if (killConfirm !== String(killTarget.sessionId)) {
      setKillMsg(`Type ${killTarget.sessionId} to confirm.`); return;
    }
    const res = await bridge.killSession(server, killTarget.sessionId);
    setKillMsg(res.message);
    if (res.success) { setKillTarget(null); setKillConfirm(""); refresh(); }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  /* Unique statuses for filter */
  const allStatuses = Array.from(new Set(sessions.map((s) => s.status).filter(Boolean))).sort();

  function toggleStatus(st: string) {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(st)) next.delete(st); else next.add(st);
      return next;
    });
  }

  /* Set of session IDs that are blockers (someone else is blocked by them) */
  const blockerIds = new Set(sessions.filter((s) => s.blockingSessionId > 0).map((s) => s.blockingSessionId));

  /* filter + sort */
  const lc = filter.toLowerCase();
  const filtered = sessions.filter((s) => {
    if (statusFilter.size > 0 && !statusFilter.has(s.status)) return false;
    if (quickFilter === "blocked" && s.blockingSessionId <= 0) return false;
    if (quickFilter === "blocking" && !blockerIds.has(s.sessionId)) return false;
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
    const av = (a[sortKey] ?? 0) as number;
    const bv = (b[sortKey] ?? 0) as number;
    return sortAsc ? av - bv : bv - av;
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(false); }
  }
  const arrow = (key: SortKey) => sortKey === key ? (sortAsc ? " \u25B2" : " \u25BC") : "";

  /* Expensive queries sort */
  function toggleExpSort(key: ExpSortKey) {
    if (expSortKey === key) setExpSortAsc((v) => !v);
    else { setExpSortKey(key); setExpSortAsc(false); }
  }
  const expArrow = (key: ExpSortKey) => expSortKey === key ? (expSortAsc ? " \u25B2" : " \u25BC") : "";

  const sortedExpensive = useMemo(() => {
    return [...expensive].sort((a, b) => {
      const av = (a[expSortKey] ?? 0) as number;
      const bv = (b[expSortKey] ?? 0) as number;
      return expSortAsc ? av - bv : bv - av;
    });
  }, [expensive, expSortKey, expSortAsc]);

  /* Row class for coloring */
  function rowClass(s: SessionInfo): string {
    const cls: string[] = [];
    if (expandedRows.has(s.sessionId)) cls.push("row-selected");
    if (blockerIds.has(s.sessionId)) cls.push("row-blocker");
    else if (s.blockingSessionId > 0) cls.push("row-blocked");
    else if (s.status === "running") cls.push("row-running");
    return cls.join(" ");
  }

  /* blocking tree */
  interface BlockNode extends BlockingProcess { children: BlockNode[]; }

  function buildBlockingTree(rows: BlockingProcess[]): BlockNode[] {
    const map = new Map<number, BlockNode>();
    const roots: BlockNode[] = [];
    for (const r of rows) map.set(r.sessionId, { ...r, children: [] });
    for (const node of map.values()) {
      if (node.blockingSessionId && map.has(node.blockingSessionId)) {
        map.get(node.blockingSessionId)!.children.push(node);
      } else { roots.push(node); }
    }
    return roots;
  }

  function toggleBlockExpand(spid: number) {
    setBlockExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(spid)) next.delete(spid); else next.add(spid);
      return next;
    });
  }

  function toggleBlockDetail(spid: number, type: "sql" | "plan") {
    setBlockDetail((prev) =>
      prev && prev.spid === spid && prev.type === type ? null : { spid, type },
    );
  }

  function formatDuration(sec: number): string {
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
    return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  }

  function renderBlockNode(node: BlockNode, depth: number): React.ReactNode {
    const hasChildren = node.children.length > 0;
    const isExpanded = blockExpanded.has(node.sessionId);
    const isHead = node.blockingSessionId === 0;
    const lockInfo = node.lockedObject
      ? `${node.lockResourceType} (${node.lockMode}) on ${node.lockedObject}`
      : node.waitResource
        ? node.waitResource
        : node.waitType || "";

    return (
      <div key={node.sessionId} className="btree-node" style={{ marginLeft: depth * 20 }}>
        <div className={`btree-row ${isHead ? "btree-head" : "btree-blocked"}`}>
          {/* Expand toggle */}
          <span className="btree-toggle" onClick={() => hasChildren && toggleBlockExpand(node.sessionId)}>
            {hasChildren ? (isExpanded ? "\u25BC" : "\u25B6") : "\u00A0\u00A0"}
          </span>

          {/* SPID badge */}
          <span className="btree-spid">{node.sessionId}</span>

          {/* Main info */}
          <span className="btree-db">{node.databaseName}</span>
          {node.command && <span className="btree-cmd">{node.command}</span>}
          <span className="btree-dur">{formatDuration(node.durationSec)}</span>
          {lockInfo && <span className="btree-lock" title={node.waitResource}>{lockInfo}</span>}

          {/* Trailing info */}
          <span className="btree-user">{node.loginName}@{node.hostName}</span>

          {/* Action buttons */}
          <span className="btree-actions">
            {node.currentStatement && (
              <button className="btn-sm" onClick={() => toggleBlockDetail(node.sessionId, "sql")}
                title="Show query">SQL</button>
            )}
            {node.queryPlanXml && (
              <button className="btn-sm" onClick={() => toggleBlockDetail(node.sessionId, "plan")}
                title="Show plan">Plan</button>
            )}
            <button className="btn-sm danger" onClick={(e) => openKill(e, node)} title="Kill session">Kill</button>
          </span>
        </div>

        {/* Inline SQL / Plan detail */}
        {blockDetail && blockDetail.spid === node.sessionId && (
          <div className="btree-detail">
            <div className="btree-detail-header">
              <span>{blockDetail.type === "sql" ? "Query" : "Execution Plan (XML)"}</span>
              <button className="btn-sm" onClick={() =>
                copyToClipboard(blockDetail.type === "sql" ? (node.fullSql || node.currentStatement) : node.queryPlanXml)
              }>Copy</button>
            </div>
            <pre className="btree-detail-code">{blockDetail.type === "sql" ? (node.fullSql || node.currentStatement) : node.queryPlanXml}</pre>
          </div>
        )}

        {/* Children (blocked sessions) */}
        {isExpanded && node.children.map((c) => renderBlockNode(c, depth + 1))}
      </div>
    );
  }

  /* Collapsible section helper */
  function Section({ id, title, badge, hidden, error, children }: { id: string; title: string; badge?: string; hidden?: boolean; error?: string; children: React.ReactNode }) {
    if (hidden) return null;
    const isCollapsed = collapsed[id] ?? false;
    return (
      <div className={`activity-section${error ? " section-error" : ""}`}>
        <div className="activity-section-header clickable" onClick={() => toggleCollapse(id)}>
          <strong>{isCollapsed ? "\u25B6" : "\u25BC"} {title}{badge ? ` (${badge})` : ""}</strong>
        </div>
        {error && <div className="section-error-msg">{error}</div>}
        {!isCollapsed && !error && children}
      </div>
    );
  }

  const activityIcon = <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12a1 1 0 0 0-1-1h-3.4l-2.24-6a1 1 0 0 0-1.87 0L9.38 13H7.5l-1.14-3a1 1 0 0 0-1.86 0L3 13H2a1 1 0 0 0 0 2h1.5a1 1 0 0 0 .93-.64L5.5 11.72l1.07 2.84A1 1 0 0 0 7.5 15h2.5a1 1 0 0 0 .93-.64L13.49 6l1.57 4.64A1 1 0 0 0 16 11.5h4a1 1 0 0 0 1-1Z"/></svg>;

  return (
    <div className="activity-panel">
      {/* Header */}
      <PageHeader icon={activityIcon} title={`Activity — ${server}`} server={server} pageColor="#2a4a2a" />
      <div className="activity-header" style={{ borderBottom: 'none', marginTop: -4 }}>
        <div className="activity-controls">
          <span style={{ fontSize: 11, color: "var(--fg-dim)" }}>Refresh:</span>
          <select value={interval} onChange={(e) => setInterval_(Number(e.target.value))}>
            {REFRESH_OPTIONS.map((s) => <option key={s} value={s}>{s}s</option>)}
          </select>
          <button onClick={refresh} disabled={loading}>{loading ? "..." : "Refresh"}</button>
        </div>
      </div>

      {/* Blocking tree — shown when blocking exists */}
      <Section id="blocking" title="Active Blocking" badge={String(blocking.length)} hidden={blocking.length === 0 && !sectionErrors.blocking} error={sectionErrors.blocking}>
        <div className="blocking-tree">
          {(() => {
            const tree = buildBlockingTree(blocking);
            // Auto-expand all nodes that have children
            if (blockExpanded.size === 0 && tree.length > 0) {
              const ids = new Set<number>();
              function collect(n: BlockNode) { if (n.children.length > 0) { ids.add(n.sessionId); n.children.forEach(collect); } }
              tree.forEach(collect);
              if (ids.size > 0) setTimeout(() => setBlockExpanded(ids), 0);
            }
            return tree.map((n) => renderBlockNode(n, 0));
          })()}
        </div>
      </Section>

      {/* Active requests */}
      <Section id="requests" title="Active Requests" badge={String(filtered.length)} error={sectionErrors.requests}>
        <div className="activity-filters-row">
          <input className="activity-filter" value={filter} onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter (login, host, db, command, query...)" />
          <div className="status-chips">
            <button className={`chip ${quickFilter === "blocked" ? "chip-active" : ""}`}
              onClick={() => setQuickFilter(prev => prev === "blocked" ? null : "blocked")}>blocked</button>
            <button className={`chip ${quickFilter === "blocking" ? "chip-active" : ""}`}
              onClick={() => setQuickFilter(prev => prev === "blocking" ? null : "blocking")}>blocking</button>
            {allStatuses.map((st) => (
              <button key={st}
                className={`chip ${statusFilter.has(st) ? "chip-active" : ""}`}
                onClick={() => toggleStatus(st)}>{st}</button>
            ))}
            {(statusFilter.size > 0 || quickFilter) && <button className="chip chip-clear" onClick={() => { setStatusFilter(new Set()); setQuickFilter(null); }}>Clear</button>}
          </div>
        </div>
        <div className="activity-grid-wrap">
          <table className="result-grid activity-grid">
            <thead>
              <tr>
                <th style={{width:40}}></th>
                <th style={{width:50}}>Kill</th>
                <th>SID</th><th>Blk By</th><th>Status</th><th>DB</th><th>Command</th><th>Login</th>
                <th className="sortable" onClick={() => toggleSort("cpuTime")}>CPU{arrow("cpuTime")}</th>
                <th className="sortable" onClick={() => toggleSort("reads")}>Reads{arrow("reads")}</th>
                <th className="sortable" onClick={() => toggleSort("writes")}>Writes{arrow("writes")}</th>
                <th className="sortable" onClick={() => toggleSort("logicalReads")}>Logical R{arrow("logicalReads")}</th>
                <th className="sortable" onClick={() => toggleSort("waitTime")}>Wait ms{arrow("waitTime")}</th>
                <th>Wait Type</th><th>Open Tran</th><th>Start Time</th><th>App</th><th>Host</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => {
                const isExp = expandedRows.has(s.sessionId);
                const det = rowDetails.get(s.sessionId);
                const detLoading = rowDetailLoading.has(s.sessionId);
                return (
                  <React.Fragment key={s.sessionId}>
                    <tr className={rowClass(s)} onClick={() => toggleRowExpand(s.sessionId)}>
                      <td style={{textAlign:"center"}}>{isExp ? "\u25BC" : "\u25B6"}</td>
                      <td><button className="btn-sm danger" onClick={(e) => openKill(e, s)} title="Kill">Kill</button></td>
                      <td>{s.sessionId}</td>
                      <td className="num">{s.blockingSessionId > 0 ? s.blockingSessionId : ""}</td>
                      <td>{s.status}</td>
                      <td>{s.databaseName}</td>
                      <td>{s.command}</td>
                      <td>{s.loginName}</td>
                      <td className="num">{s.cpuTime}</td><td className="num">{s.reads}</td>
                      <td className="num">{s.writes}</td><td className="num">{s.logicalReads}</td>
                      <td className="num">{s.waitTime}</td><td>{s.waitType ?? ""}</td>
                      <td className="num">{s.openTransactionCount || ""}</td>
                      <td>{s.startTime ?? ""}</td>
                      <td>{s.programName}</td><td>{s.hostName}</td>
                    </tr>
                    {isExp && (
                      <tr className="row-detail-expand">
                        <td colSpan={18}>
                          {detLoading && <div className="loading">Loading query...</div>}
                          {!detLoading && det && (
                            <div className="inline-detail">
                              <div className="inline-detail-actions">
                                {det.queryPlan && <button className="btn-sm" onClick={(e) => { e.stopPropagation(); openPlanModal(`Session ${s.sessionId} Plan`, det.queryPlan!); }}>Show Plan</button>}
                                {det.queryText && <button className="btn-sm" onClick={(e) => { e.stopPropagation(); copyToClipboard(det.queryText); }}>Copy</button>}
                              </div>
                              <HighlightedSql text={det.queryText} />
                            </div>
                          )}
                          {!detLoading && !det && <div className="loading">No active request (idle or completed).</div>}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {sorted.length === 0 && (
                <tr><td colSpan={18} style={{ textAlign: "center", color: "var(--fg-dim)" }}>No active requests</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Kill confirmation */}
      {killTarget && (
        <div className="activity-section activity-kill">
          <div className="activity-section-header">
            <strong>Kill Session {killTarget.sessionId}</strong>
            <button className="btn-sm" onClick={() => { setKillTarget(null); setKillMsg(""); }}>Cancel</button>
          </div>
          <div className="kill-info">
            <div><b>Login:</b> {"loginName" in killTarget ? killTarget.loginName : ""}</div>
            <div><b>Host:</b> {"hostName" in killTarget ? killTarget.hostName : ""}</div>
            <div><b>App:</b> {"programName" in killTarget ? (killTarget as SessionInfo).programName : ""}</div>
            <div><b>Query:</b> <code>{killTarget.currentStatement ?? "\u2014"}</code></div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0" }}>
            <span>Type session ID to confirm:</span>
            <input value={killConfirm} onChange={(e) => setKillConfirm(e.target.value)}
              placeholder={String(killTarget.sessionId)} style={{ width: 80 }} autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleKill(); }} />
            <button className="danger" onClick={handleKill}>Kill</button>
          </div>
          {killMsg && <div className={killMsg.startsWith("Session") ? "success-msg" : "error-msg"}>{killMsg}</div>}
        </div>
      )}

      {/* Expensive queries */}
      <Section id="expensive" title="Recent Expensive Queries (Top 30)" error={sectionErrors.expensive}>
        <div className="activity-grid-wrap">
          <table className="result-grid activity-grid">
            <thead>
              <tr>
                <th style={{width:40}}></th>
                <th className="sortable" onClick={() => toggleExpSort("executionCount")}>DB</th>
                <th className="sortable" onClick={() => toggleExpSort("executionCount")}>Exec Count{expArrow("executionCount")}</th>
                <th className="sortable" onClick={() => toggleExpSort("totalCpuMs")}>Total CPU ms{expArrow("totalCpuMs")}</th>
                <th className="sortable" onClick={() => toggleExpSort("avgCpuMs")}>Avg CPU ms{expArrow("avgCpuMs")}</th>
                <th className="sortable" onClick={() => toggleExpSort("totalReads")}>Total Reads{expArrow("totalReads")}</th>
                <th className="sortable" onClick={() => toggleExpSort("avgReads")}>Avg Reads{expArrow("avgReads")}</th>
                <th className="sortable" onClick={() => toggleExpSort("totalDurationMs")}>Total Dur ms{expArrow("totalDurationMs")}</th>
                <th className="sortable" onClick={() => toggleExpSort("avgDurationMs")}>Avg Dur ms{expArrow("avgDurationMs")}</th>
                <th>Last Exec</th>
              </tr>
            </thead>
            <tbody>
              {sortedExpensive.map((q, i) => {
                const isExpanded = expandedExp.has(i);
                return (
                  <React.Fragment key={i}>
                    <tr onClick={() => setExpandedExp((prev) => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; })} style={{ cursor: "pointer" }}>
                      <td style={{textAlign:"center"}}>{isExpanded ? "\u25BC" : "\u25B6"}</td>
                      <td>{q.databaseName}</td>
                      <td className="num">{q.executionCount.toLocaleString()}</td>
                      <td className="num">{q.totalCpuMs.toLocaleString()}</td>
                      <td className="num">{q.avgCpuMs.toLocaleString()}</td>
                      <td className="num">{q.totalReads.toLocaleString()}</td>
                      <td className="num">{q.avgReads.toLocaleString()}</td>
                      <td className="num">{q.totalDurationMs.toLocaleString()}</td>
                      <td className="num">{q.avgDurationMs.toLocaleString()}</td>
                      <td>{q.lastExecutionTime}</td>
                    </tr>
                    {isExpanded && (
                      <tr className="row-detail-expand">
                        <td colSpan={10}>
                          <div className="inline-detail">
                            <div className="inline-detail-actions">
                              {q.queryPlanXml && <button className="btn-sm" onClick={(e) => { e.stopPropagation(); openPlanModal(`Expensive Query #${i + 1} Plan`, q.queryPlanXml!); }}>Show Plan</button>}
                              <button className="btn-sm" onClick={(e) => { e.stopPropagation(); copyToClipboard(q.queryText); }}>Copy</button>
                            </div>
                            <HighlightedSql text={q.queryText} />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Plan viewer modal */}
      {planModal && (
        <div className="modal-overlay" onClick={() => setPlanModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: "min(95vw, 1000px)", maxHeight: "90vh" }}>
            <div className="modal-header">
              <span>{planModal.title}</span>
              <button onClick={() => setPlanModal(null)}>Close</button>
            </div>
            <div className="modal-body">
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                <button className="btn-sm" onClick={() => copyToClipboard(planModal.xml)}>Copy XML</button>
              </div>
              <HighlightedXml text={planModal.xml} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Syntax-highlighted SQL block ---------- */
function HighlightedSql({ text }: { text: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.textContent = text;
      hljs.highlightElement(ref.current);
    }
  }, [text]);
  return <pre className="detail-code"><code ref={ref} className="language-sql">{text}</code></pre>;
}

/* ---------- Syntax-highlighted XML block ---------- */
function HighlightedXml({ text }: { text: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.textContent = text;
      hljs.highlightElement(ref.current);
    }
  }, [text]);
  return <pre className="detail-code detail-plan"><code ref={ref} className="language-xml">{text}</code></pre>;
}
