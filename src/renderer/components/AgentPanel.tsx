import { useState, useEffect, useRef, useCallback } from "react";
import { bridge } from "../bridge";
import type { AgentJob, AgentJobStep, RunningJob } from "../../shared/types";

interface Props { server: string; onShowSql?: (prefix: string) => void; }

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
}

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

  // Filters for All Jobs
  const [jobFilter, setJobFilter] = useState("");
  const [quickFilter, setQuickFilter] = useState<"disabled" | "success" | "failed" | null>(null);

  // Sort for running jobs
  const [runningSortBy, setRunningSortBy] = useState<"duration" | null>(null);
  const [runningSortAsc, setRunningSortAsc] = useState(true);

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

  /* Running jobs sorting */
  const sortedRunning = [...running];
  if (runningSortBy === "duration") {
    sortedRunning.sort((a, b) => runningSortAsc ? a.durationSec - b.durationSec : b.durationSec - a.durationSec);
  }

  function toggleDurationSort() {
    if (runningSortBy === "duration") {
      setRunningSortAsc(!runningSortAsc);
    } else {
      setRunningSortBy("duration");
      setRunningSortAsc(false);
    }
  }

  /* All jobs filtering */
  const lc = jobFilter.toLowerCase();
  let filteredJobs = jobs;
  if (lc) filteredJobs = filteredJobs.filter(j => j.jobName.toLowerCase().includes(lc));
  if (quickFilter === "disabled") filteredJobs = filteredJobs.filter(j => !j.enabled);
  if (quickFilter === "success") filteredJobs = filteredJobs.filter(j => j.lastRunOutcome === "Succeeded");
  if (quickFilter === "failed") filteredJobs = filteredJobs.filter(j => j.lastRunOutcome === "Failed");

  function outcomeIcon(outcome: string): string {
    if (outcome === "Succeeded") return "✅";
    if (outcome === "Failed") return "❌";
    return "";
  }

  function outcomeColor(outcome: string): string {
    if (outcome === "Succeeded") return "var(--success, #28a745)";
    if (outcome === "Failed") return "var(--danger, #dc3545)";
    return "var(--fg-dim)";
  }

  return (
    <div className="activity-panel">
      <div className="activity-header">
        <h3>🤖 Agent — {server}</h3>
        <button onClick={refresh} disabled={loading}>{loading ? "..." : "⟳ Refresh"}</button>
      </div>

      {msg && <div className="success-msg" style={{ padding: "4px 0" }}>{msg}</div>}

      {/* Running jobs */}
      <div className={`activity-section${errors.running ? " section-error" : ""}`}>
        <div className="activity-section-header">
          <strong>Running Jobs ({running.length})</strong>
        </div>
        {errors.running ? <div className="section-error-msg">⚠ {errors.running}</div> : (
        <>
        {running.length === 0 ? (
          <div className="loading">No running jobs.</div>
        ) : (
          <table className="result-grid">
            <thead>
              <tr>
                <th>Job</th>
                <th>Started</th>
                <th>Current Step</th>
                <th style={{ cursor: "pointer" }} onClick={toggleDurationSort}>
                  Duration {runningSortBy === "duration" ? (runningSortAsc ? "▲" : "▼") : ""}
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedRunning.map((r) => (
                <tr key={r.jobId}>
                  <td>{r.jobName}</td>
                  <td>{r.startTime}</td>
                  <td>{r.currentStep}. {r.currentStepName}</td>
                  <td>{formatDuration(r.durationSec)}</td>
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

      {/* All jobs */}
      <div className={`activity-section${errors.jobs ? " section-error" : ""}`}>
        <div className="activity-section-header">
          <strong>All Jobs ({filteredJobs.length}/{jobs.length})</strong>
        </div>
        {errors.jobs ? <div className="section-error-msg">⚠ {errors.jobs}</div> : (
        <>
        {/* Filter bar */}
        <div style={{ display: "flex", gap: 8, padding: "4px 8px", alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={jobFilter}
            onChange={(e) => setJobFilter(e.target.value)}
            placeholder="Filter by job name..."
            style={{ flex: 1, minWidth: 150 }}
          />
          <button
            className={`btn-sm${quickFilter === "disabled" ? " active" : ""}`}
            style={{ background: quickFilter === "disabled" ? "#555" : undefined }}
            onClick={() => setQuickFilter(quickFilter === "disabled" ? null : "disabled")}
          >disabled</button>
          <button
            className={`btn-sm${quickFilter === "success" ? " active" : ""}`}
            style={{ background: quickFilter === "success" ? "var(--success, #28a745)" : undefined }}
            onClick={() => setQuickFilter(quickFilter === "success" ? null : "success")}
          >success</button>
          <button
            className={`btn-sm${quickFilter === "failed" ? " active" : ""}`}
            style={{ background: quickFilter === "failed" ? "var(--danger, #dc3545)" : undefined }}
            onClick={() => setQuickFilter(quickFilter === "failed" ? null : "failed")}
          >failed</button>
          {(jobFilter || quickFilter) && (
            <button className="btn-sm" onClick={() => { setJobFilter(""); setQuickFilter(null); }}>Clear</button>
          )}
        </div>
        <div className="activity-grid-wrap">
          <table className="result-grid">
            <thead>
              <tr>
                <th>Job Name</th><th>Last Run</th><th>Outcome</th><th>Next Run</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.map((j) => {
                const rowStyle: React.CSSProperties = !j.enabled ? { color: "var(--fg-dim)" } : {};
                return (
                  <tr key={j.jobId} style={rowStyle}>
                    <td title={j.description}>
                      {j.lastRunOutcome === "Succeeded" && <span style={{ marginRight: 4 }}>✅</span>}
                      {j.lastRunOutcome === "Failed" && <span style={{ marginRight: 4 }}>❌</span>}
                      {j.jobName}
                    </td>
                    <td>{j.lastRunDate ?? "—"}</td>
                    <td style={{ color: outcomeColor(j.lastRunOutcome) }}>{j.lastRunOutcome}</td>
                    <td>{j.nextRunDate ?? "—"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button
                        className="btn-sm"
                        style={{ background: "var(--success, #28a745)", color: "#fff", border: "none", padding: "2px 8px" }}
                        onClick={() => openStartAtStep(j)}
                        title="Start"
                      >▶</button>
                      {j.enabled ? (
                        <button
                          className="btn-sm"
                          style={{ background: "#cc0", color: "#333", border: "none", marginLeft: 2, padding: "2px 8px" }}
                          onClick={() => handleToggle(j, false)}
                          title="Disable"
                        >⏻</button>
                      ) : (
                        <button
                          className="btn-sm"
                          style={{ background: "var(--warning, #fd7e14)", color: "#fff", border: "none", marginLeft: 2, padding: "2px 8px" }}
                          onClick={() => handleToggle(j, true)}
                          title="Enable"
                        >⏼</button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredJobs.length === 0 && (
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
