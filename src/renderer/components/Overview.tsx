import { useState, useEffect, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { bridge } from "../bridge";
import type {
  TreeContext, CpuSnapshot, CpuByDatabase, WaitStatInfo, BlockingProcess,
} from "../../shared/types";

interface Props {
  ctx: TreeContext;
}

export function Overview({ ctx }: Props) {
  const [cpu, setCpu] = useState<CpuSnapshot[]>([]);
  const [cpuByDb, setCpuByDb] = useState<CpuByDatabase[]>([]);
  const [waits, setWaits] = useState<WaitStatInfo[]>([]);
  const [blocking, setBlocking] = useState<BlockingProcess[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, d, w, b] = await Promise.all([
        bridge.getCpuOverview(ctx.server),
        bridge.getCpuByDb(ctx.server),
        bridge.getWaitStats(ctx.server),
        bridge.getBlocking(ctx.server),
      ]);
      setCpu(c.reverse());
      setCpuByDb(d);
      setWaits(w);
      setBlocking(b);
    } finally {
      setLoading(false);
    }
  }, [ctx.server]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="overview-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>{ctx.server}</h2>
        <button onClick={load}>Refresh</button>
      </div>

      {loading && <div className="loading">Loading...</div>}

      {/* ---- CPU over time ---- */}
      {!loading && cpu.length > 0 && (
        <div className="chart-wrapper">
          <h3>CPU Usage (%)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={cpu}>
              <XAxis dataKey="eventTime" fontSize={10} />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="sqlCpu" stackId="1" stroke="#0088FE" fill="#0088FE" name="SQL Server" />
              <Area type="monotone" dataKey="otherCpu" stackId="1" stroke="#FF8042" fill="#FF8042" name="Other" />
              <Area type="monotone" dataKey="systemIdle" stackId="1" stroke="#3c3c3c" fill="#3c3c3c" name="Idle" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ---- CPU by database ---- */}
      {!loading && cpuByDb.length > 0 && (
        <div className="chart-wrapper">
          <h3>CPU by Database (ms since restart)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={cpuByDb}>
              <XAxis dataKey="databaseName" angle={-30} textAnchor="end" height={70} fontSize={11} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="totalCpuMs" fill="#00C49F" name="Total CPU ms" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ---- Wait Stats ---- */}
      {!loading && waits.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h3>Top Wait Stats</h3>
          <div style={{ overflow: "auto" }}>
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
                    <td>{w.waitCount.toLocaleString()}</td>
                    <td>{w.waitTimeMs.toLocaleString()}</td>
                    <td>{w.signalWaitMs.toLocaleString()}</td>
                    <td>{w.resourceWaitMs.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---- Blocking ---- */}
      {!loading && (
        <div style={{ marginTop: 16 }}>
          <h3>Current Blocking</h3>
          {blocking.length === 0 ? (
            <div style={{ color: "var(--fg-dim)" }}>No blocking detected.</div>
          ) : (
            <div style={{ overflow: "auto" }}>
              <table className="result-grid">
                <thead>
                  <tr>
                    <th>Session</th>
                    <th>Blocked By</th>
                    <th>Wait Type</th>
                    <th>Wait ms</th>
                    <th>Database</th>
                    <th>Statement</th>
                  </tr>
                </thead>
                <tbody>
                  {blocking.map((b, i) => (
                    <tr key={i}>
                      <td>{b.sessionId}</td>
                      <td>{b.blockingSessionId}</td>
                      <td>{b.waitType}</td>
                      <td>{b.waitTimeMs.toLocaleString()}</td>
                      <td>{b.databaseName}</td>
                      <td style={{ maxWidth: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {b.currentStatement}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
