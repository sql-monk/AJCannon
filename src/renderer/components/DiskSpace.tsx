import { useState, useEffect, useCallback } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { bridge } from "../bridge";
import type {
  TreeContext,
  VolumeSpaceInfo,
  DatabaseSpaceOnVolume,
  FileSpaceInfo,
  ObjectSpaceInfo,
  ShrinkRequest,
} from "../../shared/types";

const COLORS = [
  "#0088FE", "#00C49F", "#FFBB28", "#FF8042",
  "#845EC2", "#D65DB1", "#FF6F91", "#FF9671",
];

type DrillLevel = "volumes" | "databases" | "files" | "objects";

interface Props {
  ctx: TreeContext;
}

export function DiskSpace({ ctx }: Props) {
  const [level, setLevel] = useState<DrillLevel>("volumes");
  const [loading, setLoading] = useState(false);
  const [shrinkMsg, setShrinkMsg] = useState("");

  // data per level
  const [volumes, setVolumes] = useState<VolumeSpaceInfo[]>([]);
  const [databases, setDatabases] = useState<DatabaseSpaceOnVolume[]>([]);
  const [files, setFiles] = useState<FileSpaceInfo[]>([]);
  const [objects, setObjects] = useState<ObjectSpaceInfo[]>([]);

  // breadcrumb state
  const [selVolume, setSelVolume] = useState("");
  const [selDb, setSelDb] = useState("");
  const [selFileId, setSelFileId] = useState<number>(0);
  const [selFileName, setSelFileName] = useState("");

  const loadVolumes = useCallback(async () => {
    setLoading(true);
    setShrinkMsg("");
    try {
      const data = await bridge.getVolumes(ctx.server);
      setVolumes(data);
      setLevel("volumes");
    } finally {
      setLoading(false);
    }
  }, [ctx.server]);

  useEffect(() => { loadVolumes(); }, [loadVolumes]);

  async function drillToDatabase(volumeMountPoint: string) {
    setSelVolume(volumeMountPoint);
    setLoading(true);
    try {
      const data = await bridge.getDbSpace(ctx.server, volumeMountPoint);
      setDatabases(data);
      setLevel("databases");
    } finally {
      setLoading(false);
    }
  }

  async function drillToFiles(dbName: string) {
    setSelDb(dbName);
    setLoading(true);
    try {
      const data = await bridge.getFileSpace(ctx.server, dbName);
      setFiles(data);
      setLevel("files");
    } finally {
      setLoading(false);
    }
  }

  async function drillToObjects(fileId: number, fileName: string) {
    setSelFileId(fileId);
    setSelFileName(fileName);
    setLoading(true);
    try {
      const data = await bridge.getObjectSpace(ctx.server, selDb, fileId);
      setObjects(data);
      setLevel("objects");
    } finally {
      setLoading(false);
    }
  }

  async function handleShrink(req: ShrinkRequest) {
    if (!confirm(`Shrink ${req.databaseName}${req.fileId != null ? ` file ${req.fileId}` : ""}?`)) return;
    setShrinkMsg("");
    const result = await bridge.shrink(req);
    setShrinkMsg(result.message);
    if (level === "files") await drillToFiles(selDb);
  }

  /* ---------- Breadcrumb ---------- */
  function Breadcrumb() {
    const parts: { label: string; onClick?: () => void }[] = [
      { label: `${ctx.server} — Volumes`, onClick: loadVolumes },
    ];
    if (level === "databases" || level === "files" || level === "objects") {
      parts.push({ label: selVolume, onClick: () => drillToDatabase(selVolume) });
    }
    if (level === "files" || level === "objects") {
      parts.push({ label: selDb, onClick: () => drillToFiles(selDb) });
    }
    if (level === "objects") {
      parts.push({ label: selFileName });
    }

    return (
      <div className="breadcrumb" style={{ marginBottom: 8, fontSize: 13 }}>
        {parts.map((p, i) => (
          <span key={i}>
            {i > 0 && " › "}
            {p.onClick ? (
              <a href="#" onClick={(e) => { e.preventDefault(); p.onClick!(); }} style={{ color: "var(--accent-hover)" }}>
                {p.label}
              </a>
            ) : (
              <strong>{p.label}</strong>
            )}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="disk-space">
      <Breadcrumb />
      {loading && <div className="loading">Loading...</div>}
      {shrinkMsg && <div className="success-msg">{shrinkMsg}</div>}

      {/* ======== VOLUMES ======== */}
      {!loading && level === "volumes" && volumes.length > 0 && (
        <>
          <div className="chart-wrapper" style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {volumes.map((v) => (
              <div key={v.volumeMountPoint} style={{ textAlign: "center", cursor: "pointer" }}
                onClick={() => drillToDatabase(v.volumeMountPoint)}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  {v.volumeMountPoint} {v.volumeName && `(${v.volumeName})`}
                </div>
                <ResponsiveContainer width={200} height={200}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Used", value: v.usedMB },
                        { name: "Free", value: v.freeMB },
                      ]}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                    >
                      <Cell fill="#0088FE" />
                      <Cell fill="#3c3c3c" />
                    </Pie>
                    <Tooltip formatter={(val: number) => `${val.toLocaleString()} MB`} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ fontSize: 11, color: "var(--fg-dim)" }}>
                  {v.usedMB.toLocaleString()} / {v.totalMB.toLocaleString()} MB
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ======== DATABASES ON VOLUME ======== */}
      {!loading && level === "databases" && databases.length > 0 && (
        <>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={databases}>
                <XAxis dataKey="databaseName" angle={-30} textAnchor="end" height={70} fontSize={11} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="totalSizeMB" fill="#00C49F" name="Size MB"
                  onClick={(d: DatabaseSpaceOnVolume) => drillToFiles(d.databaseName)}
                  cursor="pointer"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ overflow: "auto" }}>
            <table className="result-grid">
              <thead>
                <tr><th>Database</th><th>Size MB</th></tr>
              </thead>
              <tbody>
                {databases.map((d) => (
                  <tr key={d.databaseId}>
                    <td>
                      <a href="#" onClick={(e) => { e.preventDefault(); drillToFiles(d.databaseName); }}
                        style={{ color: "var(--accent-hover)" }}>
                        {d.databaseName}
                      </a>
                    </td>
                    <td>{d.totalSizeMB}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ======== FILES IN DATABASE ======== */}
      {!loading && level === "files" && files.length > 0 && (
        <>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={files}>
                <XAxis dataKey="fileName" angle={-30} textAnchor="end" height={70} fontSize={11} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="usedMB" stackId="a" fill="#0088FE" name="Used MB" />
                <Bar dataKey="freeMB" stackId="a" fill="#3c3c3c" name="Free MB" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ overflow: "auto" }}>
            <table className="result-grid">
              <thead>
                <tr>
                  <th>File</th><th>Type</th><th>Filegroup</th>
                  <th>Size MB</th><th>Used MB</th><th>Free MB</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.fileId}>
                    <td>
                      {f.fileType === "ROWS" ? (
                        <a href="#" onClick={(e) => { e.preventDefault(); drillToObjects(f.fileId, f.fileName); }}
                          style={{ color: "var(--accent-hover)" }}>
                          {f.fileName}
                        </a>
                      ) : f.fileName}
                    </td>
                    <td>{f.fileType}</td>
                    <td>{f.filegroupName}</td>
                    <td>{f.sizeMB}</td>
                    <td>{f.usedMB}</td>
                    <td>{f.freeMB}</td>
                    <td>
                      <button
                        className="danger"
                        style={{ fontSize: 11, padding: "2px 6px" }}
                        onClick={() => handleShrink({
                          server: ctx.server,
                          databaseName: selDb,
                          fileId: f.fileId,
                        })}
                      >
                        Shrink
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ======== OBJECTS (tables) ON FILE ======== */}
      {!loading && level === "objects" && (
        <>
          {objects.length === 0 ? (
            <div style={{ color: "var(--fg-dim)" }}>No user tables on this filegroup.</div>
          ) : (
            <>
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={objects.slice(0, 15)}
                      dataKey="totalSpaceMB"
                      nameKey="tableName"
                      cx="50%"
                      cy="50%"
                      outerRadius={110}
                      label={(e) => `${e.tableName}: ${e.totalSpaceMB} MB`}
                    >
                      {objects.slice(0, 15).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ overflow: "auto" }}>
                <table className="result-grid">
                  <thead>
                    <tr>
                      <th>Schema</th><th>Table</th><th>Total MB</th><th>Used MB</th><th>Rows</th>
                    </tr>
                  </thead>
                  <tbody>
                    {objects.map((o, i) => (
                      <tr key={i}>
                        <td>{o.schemaName}</td>
                        <td>{o.tableName}</td>
                        <td>{o.totalSpaceMB}</td>
                        <td>{o.usedSpaceMB}</td>
                        <td>{o.rowsCount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
