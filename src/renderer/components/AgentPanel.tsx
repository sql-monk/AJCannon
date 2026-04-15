import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import hljs from "highlight.js/lib/core";
import sqlLang from "highlight.js/lib/languages/sql";
import powershellLang from "highlight.js/lib/languages/powershell";
import dosLang from "highlight.js/lib/languages/dos";
import { bridge } from "../bridge";
import { PageHeader } from "./PageHeader";
import type { AgentJob, AgentJobStep, AgentJobSchedule, RunningJob } from "../../shared/types";

interface Props { server: string; onShowSql?: (prefix: string) => void; }

hljs.registerLanguage("sql", sqlLang);
hljs.registerLanguage("powershell", powershellLang);
hljs.registerLanguage("dos", dosLang);

function subsystemToLang(subsystem: string): string {
  const s = subsystem.toUpperCase();
  if (s === "TSQL" || s === "TRANSACTSQL" || s === "SQL") return "sql";
  if (s === "POWERSHELL" || s === "CMDEXEC:POWERSHELL") return "powershell";
  return "dos";
}

function formatDuration(sec: number): string {
  if (sec < 0) return "0s";
  if (sec >= 7 * 86400) return "more than 1w";
  if (sec >= 86400) { const d = Math.floor(sec / 86400); const h = Math.floor((sec % 86400) / 3600); return `${d}d ${h}h`; }
  if (sec >= 3600) { const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60); return `${h}h ${m}m`; }
  if (sec >= 60) { const m = Math.floor(sec / 60); const s = sec % 60; return `${m}m ${s}s`; }
  return `${sec}s`;
}

type RunningSortKey = "jobName" | "startTime" | "currentStepName" | "durationSec";
type AllJobsSortKey = "jobName" | "lastRunDate" | "lastRunOutcome" | "nextRunDate";

export function AgentPanel({ server, onShowSql }: Props) {
  const [jobs, setJobs] = useState<AgentJob[]>([]);
  const [running, setRunning] = useState<RunningJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Stop confirmation
  const [stopTarget, setStopTarget] = useState<RunningJob | null>(null);
  const [stopConfirm, setStopConfirm] = useState("");
  const [stopMsg, setStopMsg] = useState("");

  // Start at step
  const [startTarget, setStartTarget] = useState<AgentJob | null>(null);
  const [steps, setSteps] = useState<AgentJobStep[]>([]);
  const [selectedStep, setSelectedStep] = useState<number>(1);
  const [startMsg, setStartMsg] = useState("");

  // Disable confirm
  const [disableTarget, setDisableTarget] = useState<AgentJob | null>(null);

  // Running jobs filter + sort
  const [runFilter, setRunFilter] = useState("");
  const [runningSortKey, setRunningSortKey] = useState<RunningSortKey>("durationSec");
  const [runningSortAsc, setRunningSortAsc] = useState(false);

  // All Jobs filters + sort
  const [jobFilter, setJobFilter] = useState("");
  const [quickEnabledFilter, setQuickEnabledFilter] = useState<"enabled" | "disabled" | null>(null);
  const [quickOutcomeFilter, setQuickOutcomeFilter] = useState<Set<string>>(new Set());
  const [quickCategoryFilter, setQuickCategoryFilter] = useState<Set<string>>(new Set());
  const [allSortKey, setAllSortKey] = useState<AllJobsSortKey>("jobName");
  const [allSortAsc, setAllSortAsc] = useState(true);

  // Expanded job details (steps + schedules loaded separately)
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<AgentJobStep[]>([]);
  const [expandedSchedules, setExpandedSchedules] = useState<AgentJobSchedule[]>([]);
  const [expandedCmd, setExpandedCmd] = useState<number | null>(null); // stepId whose command is shown
  const [stepsOpen, setStepsOpen] = useState(true);
  const [schedulesOpen, setSchedulesOpen] = useState(true);

  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const errs: Record<string, string> = {};
    const [j, r] = await Promise.all([
      bridge.getAgentJobs(server).catch((e: unknown) => { errs.jobs = e instanceof Error ? e.message : String(e); return null; }),
      bridge.getRunningJobs(server).catch((e: unknown) => { errs.running = e instanceof Error ? e.message : String(e); return null; }),
    ]);
    if (!mountedRef.current) return;
    if (j !== null) setJobs(j);
    if (r !== null) setRunning(r);
    setErrors(errs);
    setLoading(false);
  }, [server]);

  useEffect(() => {
    mountedRef.current = true;
    refresh();
    return () => { mountedRef.current = false; };
  }, [server, refresh]);

  /* Stop job */
  async function handleStop() {
    if (!stopTarget) return;
    if (stopConfirm !== "stop") { setStopMsg("Type 'stop' to confirm."); return; }
    const res = await bridge.stopAgentJob(server, stopTarget.jobId);
    setStopMsg(res.message);
    if (res.success) { setStopTarget(null); setStopConfirm(""); refresh(); }
  }

  /* Toggle enable/disable */
  async function handleToggle(job: AgentJob, enable: boolean) {
    if (!enable) {
      setDisableTarget(job);
    } else {
      const res = await bridge.toggleAgentJob(server, job.jobId, true);
      setMsg(res.message);
      refresh();
    }
  }

  async function confirmDisable() {
    if (!disableTarget) return;
    const res = await bridge.toggleAgentJob(server, disableTarget.jobId, false);
    setMsg(res.message);
    setDisableTarget(null);
    refresh();
  }

  /* Start at step */
  async function openStartAtStep(job: AgentJob) {
    setStartTarget(job);
    setStartMsg("");
    setSelectedStep(1);
    const s = await bridge.getJobSteps(server, job.jobId);
    setSteps(s);
    if (s.length > 0) setSelectedStep(s[0].stepId);
  }

  async function handleStartAtStep() {
    if (!startTarget) return;
    const res = await bridge.startJobAtStep(server, startTarget.jobId, selectedStep);
    setStartMsg(res.message);
    if (res.success) { setStartTarget(null); refresh(); }
  }

  /* Expand job — load steps + schedules */
  async function toggleExpandJob(jobId: string) {
    if (expandedJobId === jobId) {
      setExpandedJobId(null);
      return;
    }
    setExpandedJobId(jobId);
    setExpandedCmd(null);
    setStepsOpen(true);
    setSchedulesOpen(true);
    const [s, sch] = await Promise.all([
      bridge.getJobSteps(server, jobId),
      bridge.getJobSchedules(server, jobId),
    ]);
    setExpandedSteps(s);
    setExpandedSchedules(sch);
  }

  /* Running jobs: filtered + sorted */
  const sortedRunning = useMemo(() => {
    let list = [...running];
    const rl = runFilter.toLowerCase();
    if (rl) {
      list = list.filter(r => r.jobName.toLowerCase().includes(rl) || r.currentStepName.toLowerCase().includes(rl));
    }
    list.sort((a, b) => {
      const av = a[runningSortKey];
      const bv = b[runningSortKey];
      if (typeof av === "number" && typeof bv === "number") return runningSortAsc ? av - bv : bv - av;
      return runningSortAsc
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return list;
  }, [running, runFilter, runningSortKey, runningSortAsc]);

  function toggleRunSort(key: RunningSortKey) {
    if (runningSortKey === key) setRunningSortAsc(!runningSortAsc);
    else { setRunningSortKey(key); setRunningSortAsc(key === "jobName"); }
  }

  function runSortIcon(key: RunningSortKey) {
    if (runningSortKey !== key) return "";
    return runningSortAsc ? " ▲" : " ▼";
  }

  /* All jobs: filtered + sorted */
  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    jobs.forEach(j => { if (j.categoryName) cats.add(j.categoryName); });
    return Array.from(cats).sort();
  }, [jobs]);

  const filteredSortedJobs = useMemo(() => {
    let list = [...jobs];
    const lc = jobFilter.toLowerCase();
    if (lc) list = list.filter(j => j.jobName.toLowerCase().includes(lc));
    if (quickEnabledFilter === "enabled") list = list.filter(j => j.enabled);
    if (quickEnabledFilter === "disabled") list = list.filter(j => !j.enabled);
    if (quickOutcomeFilter.size > 0) {
      list = list.filter(j => {
        if (quickOutcomeFilter.has("success") && j.lastRunOutcome === "Succeeded") return true;
        if (quickOutcomeFilter.has("failed") && j.lastRunOutcome === "Failed") return true;
        if (quickOutcomeFilter.has("stopped") && j.lastRunOutcome === "Canceled") return true;
        if (quickOutcomeFilter.has("unknown") && !["Succeeded", "Failed", "Canceled"].includes(j.lastRunOutcome)) return true;
        return false;
      });
    }
    if (quickCategoryFilter.size > 0) {
      list = list.filter(j => quickCategoryFilter.has(j.categoryName));
    }

    list.sort((a, b) => {
      const av = a[allSortKey] ?? "";
      const bv = b[allSortKey] ?? "";
      if (typeof av === "string" && typeof bv === "string") {
        return allSortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return 0;
    });
    return list;
  }, [jobs, jobFilter, quickEnabledFilter, quickOutcomeFilter, quickCategoryFilter, allSortKey, allSortAsc]);

  function toggleAllSort(key: AllJobsSortKey) {
    if (allSortKey === key) setAllSortAsc(!allSortAsc);
    else { setAllSortKey(key); setAllSortAsc(true); }
  }

  function allSortIcon(key: AllJobsSortKey) {
    if (allSortKey !== key) return "";
    return allSortAsc ? " ▲" : " ▼";
  }

  function outcomeColor(outcome: string, enabled: boolean): string {
    if (!enabled) return "var(--fg-dim)";
    if (outcome === "Succeeded") return "var(--success, #28a745)";
    if (outcome === "Failed") return "var(--danger, #dc3545)";
    return "var(--fg-dim)";
  }

  function outcomeIcon(outcome: string, enabled: boolean): string {
    if (!enabled) return "⬜";
    if (outcome === "Succeeded") return "✅";
    if (outcome === "Failed") return "❌";
    if (outcome === "Canceled") return "⏹";
    return "";
  }

  const agentIcon = <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.622 10.395l-1.097-2.65L20 6l-2-2-1.735 1.483-2.707-1.113L12.935 2h-1.954l-.632 2.401-2.645 1.115L6 4 4 6l1.453 1.789-1.08 2.657L2 11v2l2.401.655L5.516 16.3 4 18l2 2 1.791-1.46 2.606 1.072L11 22h2l.604-2.387 2.651-1.098C16.697 18.831 18 20 18 20l2-2-1.484-1.742 1.098-2.652 2.386-.612V11l-2.378-.605Z"/></svg>;

  return (
    <div className="activity-panel">
      <PageHeader icon={agentIcon} title={`Agent — ${server}`} server={server} pageColor="#4a4a2a" onRefresh={refresh} loading={loading} />

      {msg && <div className="success-msg" style={{ padding: "4px 0" }}>{msg}</div>}

      {/* ===== Running jobs ===== */}
      <div className={`activity-section${errors.running ? " section-error" : ""}`}>
        <div className="activity-section-header">
          <strong>Running Jobs ({running.length})</strong>
        </div>
        {errors.running ? <div className="section-error-msg">⚠ {errors.running}</div> : (
        <>
        {/* Filter for running jobs */}
        <div style={{ padding: "4px 8px" }}>
          <input
            value={runFilter}
            onChange={(e) => setRunFilter(e.target.value)}
            placeholder="Filter by job or step name..."
            style={{ width: "100%", maxWidth: 300, fontSize: 12 }}
          />
        </div>
        {sortedRunning.length === 0 ? (
          <div className="loading">No running jobs.</div>
        ) : (
          <table className="result-grid">
            <thead>
              <tr>
                <th style={{ cursor: "pointer" }} onClick={() => toggleRunSort("jobName")}>Job{runSortIcon("jobName")}</th>
                <th style={{ cursor: "pointer" }} onClick={() => toggleRunSort("durationSec")}>Duration{runSortIcon("durationSec")}</th>
                <th style={{ cursor: "pointer" }} onClick={() => toggleRunSort("startTime")}>Started{runSortIcon("startTime")}</th>
                <th style={{ cursor: "pointer" }} onClick={() => toggleRunSort("currentStepName")}>Current Step{runSortIcon("currentStepName")}</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedRunning.map((r) => (
                <tr key={r.jobId}>
                  <td><span style={{ color: "#89d185", marginRight: 4 }}>▶</span>{r.jobName}</td>
                  <td>{formatDuration(r.durationSec)}</td>
                  <td>{r.startTime}</td>
                  <td>{r.currentStep}. {r.currentStepName}</td>
                  <td>
                    <button className="btn-sm danger" onClick={() => { setStopTarget(r); setStopConfirm(""); setStopMsg(""); }}>
                      ■ Stop
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        </>
        )}
      </div>
      {stopTarget && (
        <div className="activity-section activity-kill">
          <div className="activity-section-header">
            <strong>Stop: {stopTarget.jobName}</strong>
            <button className="btn-sm" onClick={() => setStopTarget(null)}>Cancel</button>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0" }}>
            <span>Type <b>stop</b> to confirm:</span>
            <input value={stopConfirm} onChange={(e) => setStopConfirm(e.target.value)}
              placeholder="stop" style={{ width: 80 }} autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleStop(); }} />
            <button className="danger" onClick={handleStop}>Stop</button>
          </div>
          {stopMsg && <div className="error-msg">{stopMsg}</div>}
        </div>
      )}

      {/* ===== All jobs ===== */}
      <div className={`activity-section${errors.jobs ? " section-error" : ""}`}>
        <div className="activity-section-header">
          <strong>All Jobs ({filteredSortedJobs.length}/{jobs.length})</strong>
        </div>
        {errors.jobs ? <div className="section-error-msg">⚠ {errors.jobs}</div> : (
        <>
        {/* Filter bar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "4px 8px" }}>
          <input
            value={jobFilter}
            onChange={(e) => setJobFilter(e.target.value)}
            placeholder="Filter by job name..."
            style={{ width: "100%", maxWidth: 300 }}
          />
          <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
            {/* Enabled/Disabled group */}
            <span style={{ fontSize: 11, color: "var(--fg-dim)", marginRight: 2 }}>Status:</span>
            <button
              className={`btn-sm${quickEnabledFilter === "enabled" ? " chip-active" : ""}`}
              onClick={() => setQuickEnabledFilter(quickEnabledFilter === "enabled" ? null : "enabled")}
            >enabled</button>
            <button
              className={`btn-sm${quickEnabledFilter === "disabled" ? " chip-active" : ""}`}
              onClick={() => setQuickEnabledFilter(quickEnabledFilter === "disabled" ? null : "disabled")}
            >disabled</button>

            <span style={{ borderLeft: "1px solid var(--border)", height: 16, margin: "0 6px" }} />

            {/* Outcome group — multi-select */}
            <span style={{ fontSize: 11, color: "var(--fg-dim)", marginRight: 2 }}>Outcome:</span>
            {(["success", "failed", "stopped", "unknown"] as const).map((val) => {
              const active = quickOutcomeFilter.has(val);
              const bg = active ? (val === "success" ? "var(--success)" : val === "failed" ? "var(--danger)" : undefined) : undefined;
              const fg = active && val === "success" ? "#000" : undefined;
              return (
                <button
                  key={val}
                  className={`btn-sm${active ? " chip-active" : ""}`}
                  style={{ background: bg, color: fg }}
                  onClick={() => {
                    setQuickOutcomeFilter(prev => {
                      const next = new Set(prev);
                      if (next.has(val)) next.delete(val); else next.add(val);
                      return next;
                    });
                  }}
                >{val}</button>
              );
            })}

            <span style={{ borderLeft: "1px solid var(--border)", height: 16, margin: "0 6px" }} />

            {/* Category group — multi-select */}
            {allCategories.length > 0 && (
              <>
                <span style={{ fontSize: 11, color: "var(--fg-dim)", marginRight: 2 }}>Category:</span>
                {allCategories.map((cat) => {
                  const active = quickCategoryFilter.has(cat);
                  return (
                    <button
                      key={cat}
                      className={`btn-sm${active ? " chip-active" : ""}`}
                      onClick={() => {
                        setQuickCategoryFilter(prev => {
                          const next = new Set(prev);
                          if (next.has(cat)) next.delete(cat); else next.add(cat);
                          return next;
                        });
                      }}
                    >{cat}</button>
                  );
                })}
                <span style={{ borderLeft: "1px solid var(--border)", height: 16, margin: "0 6px" }} />
              </>
            )}

            {(jobFilter || quickEnabledFilter || quickOutcomeFilter.size > 0 || quickCategoryFilter.size > 0) && (
              <button className="btn-sm" style={{ color: "var(--danger)" }} onClick={() => { setJobFilter(""); setQuickEnabledFilter(null); setQuickOutcomeFilter(new Set()); setQuickCategoryFilter(new Set()); }}>✕ Clear</button>
            )}
          </div>
        </div>
        <div className="activity-grid-wrap">
          <table className="result-grid">
            <thead>
              <tr>
                <th style={{ cursor: "pointer" }} onClick={() => toggleAllSort("jobName")}>Job Name{allSortIcon("jobName")}</th>
                <th>Category</th>
                <th style={{ cursor: "pointer" }} onClick={() => toggleAllSort("lastRunDate")}>Last Run{allSortIcon("lastRunDate")}</th>
                <th style={{ cursor: "pointer" }} onClick={() => toggleAllSort("lastRunOutcome")}>Outcome{allSortIcon("lastRunOutcome")}</th>
                <th style={{ cursor: "pointer" }} onClick={() => toggleAllSort("nextRunDate")}>Next Run{allSortIcon("nextRunDate")}</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSortedJobs.map((j) => {
                const rowStyle: React.CSSProperties = !j.enabled ? { color: "var(--fg-dim)" } : {};
                const isExpanded = expandedJobId === j.jobId;
                return (
                  <JobRow
                    key={j.jobId}
                    job={j}
                    rowStyle={rowStyle}
                    isExpanded={isExpanded}
                    expandedSteps={expandedSteps}
                    expandedSchedules={expandedSchedules}
                    expandedCmd={expandedCmd}
                    stepsOpen={stepsOpen}
                    schedulesOpen={schedulesOpen}
                    outcomeIcon={outcomeIcon}
                    outcomeColor={outcomeColor}
                    onToggleExpand={() => toggleExpandJob(j.jobId)}
                    onToggleCmd={(stepId) => setExpandedCmd(expandedCmd === stepId ? null : stepId)}
                    onToggleSteps={() => setStepsOpen(!stepsOpen)}
                    onToggleSchedules={() => setSchedulesOpen(!schedulesOpen)}
                    onStart={() => openStartAtStep(j)}
                    onToggleEnabled={(enable) => handleToggle(j, enable)}
                  />
                );
              })}
              {filteredSortedJobs.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--fg-dim)" }}>No jobs found</td></tr>
              )}
            </tbody>
          </table>
        </div>
        </>
        )}
      </div>

      {/* Disable confirm dialog */}
      {disableTarget && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h4>Disable "{disableTarget.jobName}"?</h4>
            <div className="modal-actions">
              <button onClick={confirmDisable} className="danger">Disable</button>
              <button onClick={() => setDisableTarget(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Start at step dialog */}
      {startTarget && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h4>Start "{startTarget.jobName}" at step</h4>
            <select value={selectedStep} onChange={(e) => setSelectedStep(Number(e.target.value))}
              style={{ width: "100%", marginBottom: 8 }}>
              {steps.map((s) => (
                <option key={s.stepId} value={s.stepId}>{s.stepId}. {s.stepName} ({s.subsystem})</option>
              ))}
            </select>
            {startMsg && <div className="error-msg">{startMsg}</div>}
            <div className="modal-actions">
              <button onClick={handleStartAtStep}>Start</button>
              <button onClick={() => setStartTarget(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Expanded Job Row ---- */
function JobRow({
  job, rowStyle, isExpanded, expandedSteps, expandedSchedules, expandedCmd,
  stepsOpen, schedulesOpen,
  outcomeIcon, outcomeColor, onToggleExpand, onToggleCmd,
  onToggleSteps, onToggleSchedules, onStart, onToggleEnabled,
}: {
  job: AgentJob;
  rowStyle: React.CSSProperties;
  isExpanded: boolean;
  expandedSteps: AgentJobStep[];
  expandedSchedules: AgentJobSchedule[];
  expandedCmd: number | null;
  stepsOpen: boolean;
  schedulesOpen: boolean;
  outcomeIcon: (o: string, e: boolean) => string;
  outcomeColor: (o: string, e: boolean) => string;
  onToggleExpand: () => void;
  onToggleCmd: (stepId: number) => void;
  onToggleSteps: () => void;
  onToggleSchedules: () => void;
  onStart: () => void;
  onToggleEnabled: (enable: boolean) => void;
}) {
  return (
    <>
      <tr style={rowStyle}>
        <td title={job.description}>
          <span style={{ cursor: "pointer", marginRight: 4, fontSize: 10 }} onClick={onToggleExpand}>
            {isExpanded ? "▾" : "▸"}
          </span>
          <span style={{ marginRight: 4, opacity: job.enabled ? 1 : 0.4 }}>{outcomeIcon(job.lastRunOutcome, job.enabled)}</span>
          <span style={{ cursor: "pointer", textDecoration: "underline", textDecorationColor: "var(--fg-dim)" }} onClick={onToggleExpand}>
            {job.jobName}
          </span>
        </td>
        <td style={{ fontSize: 11, color: "var(--fg-dim)" }}>{job.categoryName || ""}</td>
        <td>{job.lastRunDate ?? "—"}</td>
        <td style={{ color: outcomeColor(job.lastRunOutcome, job.enabled), opacity: job.enabled ? 1 : 0.4 }}>
          {job.lastRunOutcome}
        </td>
        <td>{!job.enabled ? "" : (job.nextRunDate ?? "—")}</td>
        <td style={{ whiteSpace: "nowrap" }}>
          <button
            className="btn-sm"
            style={{ background: "var(--success, #28a745)", color: "#fff", border: "none", padding: "2px 8px" }}
            onClick={onStart}
            title="Start"
          >▶</button>
          {job.enabled ? (
            <button
              className="btn-sm"
              style={{ background: "#cc0", color: "#333", border: "none", marginLeft: 2, padding: "2px 8px" }}
              onClick={() => onToggleEnabled(false)}
              title="Disable"
            >⏻</button>
          ) : (
            <button
              className="btn-sm"
              style={{ background: "var(--warning, #fd7e14)", color: "#fff", border: "none", marginLeft: 2, padding: "2px 8px" }}
              onClick={() => onToggleEnabled(true)}
              title="Enable"
            >⏼</button>
          )}
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={6} style={{ padding: 0, border: "none" }}>
            <div style={{ padding: "6px 16px", background: "rgba(255,255,255,0.02)", borderTop: "1px solid var(--border)" }}>
              {/* Steps */}
              {expandedSteps.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div
                    style={{ fontWeight: 600, fontSize: 12, marginBottom: 4, cursor: "pointer", userSelect: "none" }}
                    onClick={onToggleSteps}
                  >
                    <span style={{ fontSize: 10, marginRight: 4 }}>{stepsOpen ? "▾" : "▸"}</span>
                    Steps ({expandedSteps.length})
                  </div>
                  {stepsOpen && expandedSteps.map((s) => (
                    <div key={s.stepId} style={{ marginBottom: 2, fontSize: 12 }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ color: "var(--fg-dim)", minWidth: 18, textAlign: "right" }}>{s.stepId}</span>
                        <span>{s.stepName}</span>
                        <span style={{ fontSize: 10, color: "var(--fg-dim)" }}>{s.subsystem}</span>
                        {s.command && (
                          <span
                            style={{ color: "var(--accent-hover)", cursor: "pointer", textDecoration: "underline", fontSize: 11 }}
                            onClick={() => onToggleCmd(s.stepId)}
                          >
                            {expandedCmd === s.stepId ? "hide command" : "show command"}
                          </span>
                        )}
                      </div>
                      {expandedCmd === s.stepId && s.command && (
                        <div style={{ marginLeft: 24, marginTop: 4 }}>
                          <StepCommand command={s.command} subsystem={s.subsystem} />
                          <div style={{ display: "flex", gap: 12, fontSize: 11, marginTop: 2 }}>
                            <span style={{ color: "#2e7d32" }}>{s.onSuccessAction}</span>
                            <span style={{ color: "#c62828" }}>{s.onFailAction}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {/* Schedules */}
              {expandedSchedules.length > 0 && (
                <div>
                  <div
                    style={{ fontWeight: 600, fontSize: 12, marginBottom: 4, cursor: "pointer", userSelect: "none" }}
                    onClick={onToggleSchedules}
                  >
                    <span style={{ fontSize: 10, marginRight: 4 }}>{schedulesOpen ? "▾" : "▸"}</span>
                    Schedules ({expandedSchedules.length})
                  </div>
                  {schedulesOpen && expandedSchedules.map((sch, i) => (
                    <div key={i} style={{ fontSize: 12, marginLeft: 8, marginBottom: 2 }}>
                      <span>{sch.scheduleName}</span>
                      <span style={{ color: "var(--fg-dim)", marginLeft: 8, fontSize: 11 }}>
                        ({sch.freqType}{sch.nextRunDate ? ` — next: ${sch.nextRunDate}` : ""})
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {expandedSteps.length === 0 && expandedSchedules.length === 0 && (
                <div className="loading">No steps or schedules.</div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ---- Step command with hljs highlighting ---- */
function StepCommand({ command, subsystem }: { command: string; subsystem: string }) {
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.removeAttribute("data-highlighted");
      hljs.highlightElement(ref.current);
    }
  }, [command, subsystem]);
  const lang = subsystemToLang(subsystem);
  return (
    <pre ref={ref} className={`detail-code language-${lang}`} style={{ fontSize: 11, maxHeight: 200 }}>
      {command}
    </pre>
  );
}
