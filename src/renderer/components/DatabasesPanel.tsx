import { useState, useCallback, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { bridge } from "../bridge";
import type { CpuByDatabase, BufferPoolEntry, IoByDatabase } from "../../shared/types";

interface Props {
  server: string;
}

export function DatabasesPanel({ server }: Props) {
  const [cpuByDb, setCpuByDb] = useState<CpuByDatabase[]>([]);
  const [bufferByDb, setBufferByDb] = useState<BufferPoolEntry[]>([]);
  const [ioByDb, setIoByDb] = useState<IoByDatabase[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [cpu, buf, io] = await Promise.all([
      bridge.getCpuByDb(server).catch(() => []),
      bridge.getBufferPool(server).catch(() => []),
      bridge.getIoByDb(server).catch(() => []),
    ]);
    setCpuByDb(cpu);
    setBufferByDb(buf);
    setIoByDb(io);
    setLoading(false);
  }, [server]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="page-panel">
      <div className="page-header">
        <h3>Databases — {server}</h3>
        <button onClick={refresh} disabled={loading}>{loading ? "..." : "Refresh"}</button>
      </div>

      {/* CPU by DB */}
      <div className="cpanel">
        <div className="cpanel-header"><span className="cpanel-title">CPU by Database</span></div>
        <div className="cpanel-body">
          {cpuByDb.length > 0 ? (
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cpuByDb.slice(0, 15)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="databaseName" angle={-30} textAnchor="end" height={70} fontSize={11} tick={{ fill: "var(--fg-dim)" }} />
                  <YAxis tick={{ fill: "var(--fg-dim)", fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: "var(--bg-panel)", border: "1px solid var(--border)" }} />
                  <Bar dataKey="totalCpuMs" fill="#0e639c" name="Total CPU ms" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="loading">No CPU data.</div>
          )}
        </div>
      </div>

      {/* Buffer Pool by DB */}
      <div className="cpanel">
        <div className="cpanel-header"><span className="cpanel-title">Buffer Pool by Database</span></div>
        <div className="cpanel-body">
          {bufferByDb.length > 0 ? (
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bufferByDb.slice(0, 15)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="databaseName" angle={-30} textAnchor="end" height={70} fontSize={11} tick={{ fill: "var(--fg-dim)" }} />
                  <YAxis tick={{ fill: "var(--fg-dim)", fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: "var(--bg-panel)", border: "1px solid var(--border)" }} />
                  <Bar dataKey="sizeMB" fill="#e5c07b" name="Buffer MB" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="loading">No buffer pool data.</div>
          )}
        </div>
      </div>

      {/* I/O by DB */}
      <div className="cpanel">
        <div className="cpanel-header"><span className="cpanel-title">I/O by Database</span></div>
        <div className="cpanel-body">
          {ioByDb.length > 0 ? (
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ioByDb.slice(0, 15)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="databaseName" angle={-30} textAnchor="end" height={70} fontSize={11} tick={{ fill: "var(--fg-dim)" }} />
                  <YAxis tick={{ fill: "var(--fg-dim)", fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: "var(--bg-panel)", border: "1px solid var(--border)" }} />
                  <Bar dataKey="totalReadsMB" stackId="io" fill="#0e639c" name="Reads MB" />
                  <Bar dataKey="totalWritesMB" stackId="io" fill="#f0ad4e" name="Writes MB" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="loading">No I/O data.</div>
          )}
        </div>
      </div>
    </div>
  );
}
