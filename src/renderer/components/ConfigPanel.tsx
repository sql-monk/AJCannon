import { useState, useEffect, useRef, useCallback } from "react";
import { bridge } from "../bridge";
import type { ServerConfigOption } from "../../shared/types";

interface Props { server: string; onShowSql?: (prefix: string) => void; }

export function ConfigPanel({ server, onShowSql }: Props) {
  const [config, setConfig] = useState<ServerConfigOption[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const c = await bridge.getServerConfig(server);
      if (mountedRef.current) setConfig(c);
    } catch (e: unknown) {
      if (mountedRef.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [server]);

  useEffect(() => {
    mountedRef.current = true;
    refresh();
    return () => { mountedRef.current = false; };
  }, [server, refresh]);

  const lc = filter.toLowerCase();
  const filtered = config.filter((c) => c.name.toLowerCase().includes(lc));

  return (
    <div className="activity-panel">
      <div className="activity-header">
        <h3>📋 Configuration — {server}</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "var(--fg-dim)" }}>Read-only</span>
          <button onClick={refresh} disabled={loading}>{loading ? "..." : "⟳ Refresh"}</button>
        </div>
      </div>

      <div className={`activity-section${error ? " section-error" : ""}`}>
        <div className="activity-section-header">
          <strong>Server Options ({filtered.length})</strong>
          <input className="activity-filter" value={filter} onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter options..." />
        </div>
        {error ? <div className="section-error-msg">⚠ {error}</div> :
        loading ? <div className="loading">Loading...</div> : (
          <div className="activity-grid-wrap" style={{ maxHeight: "calc(100vh - 160px)" }}>
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
        )}
      </div>
    </div>
  );
}
