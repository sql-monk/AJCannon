import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { bridge } from "../bridge";
import type { AgentJob, AgentJobStep, AgentJobSchedule, RunningJob } from "../../shared/types";

interface Props { server: string; onShowSql?: (prefix: string) => void; }

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
  const [quickOutcomeFilter, setQuickOutcomeFilter] = useState<"success" | "failed" | "stopped" | null>(null);
  const [allSortKey, setAllSortKey] = useState<AllJobsSortKey>("jobName");
  const [allSortAsc, setAllSortAsc] = useState(true);

  // Expanded job details (steps + schedules)
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<AgentJobStep[]>([]);
  const [expandedSchedules, setExpandedSchedules] = useState<AgentJobSchedule[]>([]);
  const [expandedCmd, setExpandedCmd] = useState<number | null>(null); // stepId whose command is shown

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
  const filteredSortedJobs = useMemo(() => {
    let list = [...jobs];
    const lc = jobFilter.toLowerCase();
    if (lc) list = list.filter(j => j.jobName.toLowerCase().includes(lc));
    if (quickEnabledFilter === "enabled") list = list.filter(j => j.enabled);
    if (quickEnabledFilter === "disabled") list = list.filter(j => !j.enabled);
    if (quickOutcomeFilter === "success") list = list.filter(j => j.lastRunOutcome === "Succeeded");
    if (quickOutcomeFilter === "failed") list = list.filter(j => j.lastRunOutcome === "Failed");
    if (quickOutcomeFilter === "stopped") list = list.filter(j => j.lastRunOutcome === "Canceled");

    list.sort((a, b) => {
      const av = a[allSortKey] ?? "";
      const bv = b[allSortKey] ?? "";
      if (typeof av === "string" && typeof bv === "string") {
        return allSortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return 0;
    });
    return list;
  }, [jobs, jobFilter, quickEnabledFilter, quickOutcomeFilter, allSortKey, allSortAsc]);

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

  return (
    <div className="activity-panel">
      <div className="activity-header">
        <h3>🤖 Agent — {server}</h3>
        <button onClick={refresh} disabled={loading}>{loading ? "..." : "⟳ Refresh"}</button>
      </div>

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

            {/* Outcome group */}
            <span style={{ fontSize: 11, color: "var(--fg-dim)", marginRight: 2 }}>Outcome:</span>
            <button
              className={`btn-sm${quickOutcomeFilter === "success" ? " chip-active" : ""}`}
              style={{ background: quickOutcomeFilter === "success" ? "var(--success)" : undefined, color: quickOutcomeFilter === "success" ? "#000" : undefined }}
              onClick={() => setQuickOutcomeFilter(quickOutcomeFilter === "success" ? null : "success")}
            >success</button>
            <button
              className={`btn-sm${quickOutcomeFilter === "failed" ? " chip-active" : ""}`}
              style={{ background: quickOutcomeFilter === "failed" ? "var(--danger)" : undefined }}
              onClick={() => setQuickOutcomeFilter(quickOutcomeFilter === "failed" ? null : "failed")}
            >failed</button>
            <button
              className={`btn-sm${quickOutcomeFilter === "stopped" ? " chip-active" : ""}`}
              onClick={() => setQuickOutcomeFilter(quickOutcomeFilter === "stopped" ? null : "stopped")}
            >stopped</button>

            {(jobFilter || quickEnabledFilter || quickOutcomeFilter) && (
              <button className="btn-sm" onClick={() => { setJobFilter(""); setQuickEnabledFilter(null); setQuickOutcomeFilter(null); }}>✕ Clear</button>
            )}
          </div>
        </div>
        <div className="activity-grid-wrap">
          <table className="result-grid">
            <thead>
              <tr>
                <th style={{ cursor: "pointer" }} onClick={() => toggleAllSort("jobName")}>Job Name{allSortIcon("jobName")}</th>
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
                    outcomeIcon={outcomeIcon}
                    outcomeColor={outcomeColor}
                    onToggleExpand={() => toggleExpandJob(j.jobId)}
                    onToggleCmd={(stepId) => setExpandedCmd(expandedCmd === stepId ? null : stepId)}
                    onStart={() => openStartAtStep(j)}
                    onToggleEnabled={(enable) => handleToggle(j, enable)}
                  />
                );
              })}
              {filteredSortedJobs.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--fg-dim)" }}>No jobs found</td></tr>
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
  outcomeIcon, outcomeColor, onToggleExpand, onToggleCmd, onStart, onToggleEnabled,
}: {
  job: AgentJob;
  rowStyle: React.CSSProperties;
  isExpanded: boolean;
  expandedSteps: AgentJobStep[];
  expandedSchedules: AgentJobSchedule[];
  expandedCmd: number | null;
  outcomeIcon: (o: string, e: boolean) => string;
  outcomeColor: (o: string, e: boolean) => string;
  onToggleExpand: () => void;
  onToggleCmd: (stepId: number) => void;
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
          <td colSpan={5} style={{ padding: 0, border: "none" }}>
            <div style={{ padding: "6px 16px", background: "rgba(255,255,255,0.02)", borderTop: "1px solid var(--border)" }}>
              {/* Steps */}
              {expandedSteps.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>Steps</div>
                  {expandedSteps.map((s) => (
                    <div key={s.stepId} style={{ marginBottom: 4, fontSize: 12 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span>{s.stepId} — {s.stepName} <span style={{ fontSize: 10, color: "var(--fg-dim)" }}>({s.subsystem})</span></span>
                      </div>
                      <div style={{ display: "flex", gap: 12, fontSize: 11, marginLeft: 16 }}>
                        <span style={{ color: "#2e7d32" }}>{s.onSuccessAction}</span>
                        <span style={{ color: "#c62828" }}>{s.onFailAction}</span>
                        {s.command && (
                          <span
                            style={{ color: "var(--accent-hover)", cursor: "pointer", textDecoration: "underline" }}
                            onClick={() => onToggleCmd(s.stepId)}
                          >
                            {expandedCmd === s.stepId ? "hide command" : "show command"}
                          </span>
                        )}
                      </div>
                      {expandedCmd === s.stepId && s.command && (
                        <pre className="detail-code" style={{ marginLeft: 16, marginTop: 4, fontSize: 11, maxHeight: 200 }}>{s.command}</pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {/* Schedules */}
              {expandedSchedules.length > 0 && (
                <div>
                  <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>Schedules</div>
                  {expandedSchedules.map((sch, i) => (
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
