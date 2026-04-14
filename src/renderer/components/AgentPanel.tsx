import { useState, useEffect, useRef, useCallback } from "react";
import { bridge } from "../bridge";
import type { AgentJob, AgentJobStep, RunningJob } from "../../shared/types";

interface Props { server: string; onShowSql?: (prefix: string) => void; }

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
  async function handleToggle(job: AgentJob) {
    if (job.enabled) {
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
              <tr><th>Job</th><th>Started</th><th>Current Step</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {running.map((r) => (
                <tr key={r.jobId}>
                  <td>{r.jobName}</td>
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

      {/* All jobs */}
      <div className={`activity-section${errors.jobs ? " section-error" : ""}`}>
        <div className="activity-section-header">
          <strong>All Jobs ({jobs.length})</strong>
        </div>
        {errors.jobs ? <div className="section-error-msg">⚠ {errors.jobs}</div> : (
        <div className="activity-grid-wrap">
          <table className="result-grid">
            <thead>
              <tr>
                <th>Job Name</th><th>Enabled</th><th>Last Run</th><th>Outcome</th><th>Running</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.jobId} className={!j.enabled ? "row-disabled" : ""}>
                  <td title={j.description}>{j.jobName}</td>
                  <td>{j.enabled ? "Yes" : "No"}</td>
                  <td>{j.lastRunDate ?? "—"}</td>
                  <td className={j.lastRunOutcome === "Failed" ? "text-danger" : ""}>{j.lastRunOutcome}</td>
                  <td>{j.currentlyExecuting ? "▶" : ""}</td>
                  <td>
                    <button className="btn-sm" onClick={() => handleToggle(j)}>
                      {j.enabled ? "Disable" : "Enable"}
                    </button>
                    <button className="btn-sm" onClick={() => openStartAtStep(j)} style={{ marginLeft: 2 }}>
                      ▶ Start
                    </button>
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--fg-dim)" }}>No jobs found</td></tr>
              )}
            </tbody>
          </table>
        </div>
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
