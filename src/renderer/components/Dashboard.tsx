import { useState, useEffect, useCallback, useRef } from "react";
import { bridge } from "../bridge";
import type { ServerSummary } from "../../shared/types";

interface Props {
  servers: string[];
}

function cpuColor(cpu: number): string {
  if (cpu >= 90) return "var(--red, #d9534f)";
  if (cpu >= 80) return "var(--orange, #f0ad4e)";
  if (cpu >= 75) return "var(--yellow, #f0c674)";
  return "inherit";
}

function fmtWait(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

export function Dashboard({ servers }: Props) {
  const [summaries, setSummaries] = useState<ServerSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCannonModal, setShowCannonModal] = useState(false);
  const [showSpectralModal, setShowSpectralModal] = useState(false);
  const webviewRef = useRef<HTMLElement & { insertCSS(css: string): Promise<string> } | null>(null);

  const cannonWikiUrl = "https://en.wikipedia.org/wiki/Annie_Jump_Cannon";
  const spectralWikiUrl = "https://uk.wikipedia.org/wiki/%D0%A4%D0%B0%D0%B9%D0%BB:Morgan-Keenan_spectral_classification.svg";
  const spectralImageUrl = "https://upload.wikimedia.org/wikipedia/commons/7/70/Morgan-Keenan_spectral_classification.svg";

  const load = useCallback(async () => {
    if (servers.length === 0) return;
    setLoading(true);
    try {
      const results = await Promise.all(
        servers.map((s) =>
          bridge.getServerSummary(s).catch((): ServerSummary => ({
            server: s,
            sqlCpu: -1,
            runningCount: -1,
            runnableCount: -1,
            suspendedCount: -1,
            blockingCount: -1,
            maxBlockedWaitSec: -1,
          })),
        ),
      );
      setSummaries(results);
    } finally {
      setLoading(false);
    }
  }, [servers]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (servers.length === 0) return;
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load, servers]);

  // Inject CSS into webview to hide header
  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv) return;
    const onReady = () => {
      wv.insertCSS(`
        header[data-tour-id="header"], header { display: none !important; }
        #main { margin-top: 0 !important; padding-top: 0 !important; }
      `).catch(() => {});
    };
    wv.addEventListener("dom-ready", onReady);
    return () => wv.removeEventListener("dom-ready", onReady);
  }, []);

  if (servers.length === 0) {
    return <div className="loading">Enter a server name and click Add.</div>;
  }

  return (
    <div className="dashboard">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>Dashboard</h2>
        <button onClick={load} disabled={loading}>{loading ? "..." : "Refresh"}</button>
      </div>

      <div className="dashboard-grid">
        {summaries.map((s) => (
          <div key={s.server} className="dashboard-card">
            {s.sqlCpu < 0 ? (
              <>
                <div className="dashboard-card-row">
                  <span className="dashboard-card-server">{s.server}</span>
                </div>
                <div className="error-msg" style={{ fontSize: 12 }}>Connection error</div>
              </>
            ) : (
              <>
                <div className="dashboard-card-row">
                  <span className="dashboard-card-server">{s.server}</span>
                  <span className="dashboard-card-cpu" style={{ color: cpuColor(s.sqlCpu) }}>
                    {s.sqlCpu}% CPU
                  </span>
                </div>
                <div className="dashboard-card-row">
                  <span>running: <b>{s.runningCount}</b></span>
                  <span>runnable: <b>{s.runnableCount}</b></span>
                  <span>suspended: <b>{s.suspendedCount}</b></span>
                </div>
                <div className="dashboard-card-row">
                  <span style={s.blockingCount > 0 ? { color: "var(--red, #d9534f)" } : undefined}>
                    blocked: <b>{s.blockingCount}</b>
                  </span>
                  {s.blockingCount > 0 && (
                    <span style={{ color: "var(--red, #d9534f)" }}>
                      max wait: <b>{fmtWait(s.maxBlockedWaitSec)}</b>
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* SQL Monitor — always visible, stretched to fill remaining space */}
      <div className="dashboard-monitor">
        <webview
          ref={webviewRef as React.LegacyRef<HTMLElement>}
          src="http://sqlmonitor.bank.lan:8080/GlobalDashboard"
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            filter: "invert(0.88) hue-rotate(180deg)",
          }}
        />
      </div>

      <div className="dashboard-corner dashboard-corner-left">
        <button className="dashboard-mini-btn" onClick={() => setShowCannonModal(true)}>
          Annie Jump Cannon
        </button>
      </div>

      <div className="dashboard-corner dashboard-corner-right">
        <button
          className="dashboard-image-btn"
          onClick={() => setShowSpectralModal(true)}
          title="Morgan-Keenan spectral classification"
        >
          <img src={spectralImageUrl} alt="Morgan-Keenan spectral classification" />
        </button>
      </div>

      {showCannonModal && (
        <div className="modal-overlay" onClick={() => setShowCannonModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: "min(92vw, 680px)" }}>
            <div className="modal-header">
              <span>Annie Jump Cannon</span>
              <button onClick={() => setShowCannonModal(false)}>x</button>
            </div>
            <div className="modal-body">
              <p>
                Annie Jump Cannon (1863-1941) was an American astronomer who created the
                modern stellar classification sequence O-B-A-F-G-K-M and cataloged hundreds
                of thousands of stars.
              </p>
              <br />
              <p>
                Her classification work at Harvard became the standard foundation for stellar
                spectroscopy and directly influenced the Morgan-Keenan system.
              </p>
              <br />
              <a href={cannonWikiUrl} target="_blank" rel="noreferrer" className="dashboard-external-link">
                Open Wikipedia article
              </a>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowCannonModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showSpectralModal && (
        <div className="modal-overlay" onClick={() => setShowSpectralModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: "min(96vw, 980px)" }}>
            <div className="modal-header">
              <span>Morgan-Keenan Spectral Classification</span>
              <button onClick={() => setShowSpectralModal(false)}>x</button>
            </div>
            <div className="modal-body">
              <img
                src={spectralImageUrl}
                alt="Morgan-Keenan spectral classification table"
                className="dashboard-spectral-full"
              />
              <p style={{ marginTop: 10 }}>
                The MK system groups stars by spectral class (O, B, A, F, G, K, M) and
                luminosity class (I-V). It maps stellar temperature, color, and line features.
              </p>
              <table className="result-grid" style={{ marginTop: 10 }}>
                <thead>
                  <tr>
                    <th>Class</th>
                    <th>Approx. Temperature (K)</th>
                    <th>Typical Color</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>O</td><td>{"> 30000"}</td><td>Blue</td></tr>
                  <tr><td>B</td><td>10000-30000</td><td>Blue-white</td></tr>
                  <tr><td>A</td><td>7500-10000</td><td>White</td></tr>
                  <tr><td>F</td><td>6000-7500</td><td>Yellow-white</td></tr>
                  <tr><td>G</td><td>5200-6000</td><td>Yellow</td></tr>
                  <tr><td>K</td><td>3700-5200</td><td>Orange</td></tr>
                  <tr><td>M</td><td>{"< 3700"}</td><td>Red</td></tr>
                </tbody>
              </table>
              <a href={spectralWikiUrl} target="_blank" rel="noreferrer" className="dashboard-external-link">
                Open source page on Wikipedia
              </a>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowSpectralModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
