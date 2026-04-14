import { useState, useCallback } from "react";
import { bridge } from "../bridge";
import type { TreeNode, TreeNodeType, TreeContext } from "../../shared/types";

interface Props {
  servers: string[];
  filter: string;
  onContextChange: (ctx: TreeContext) => void;
  onServerRemoved: (server: string) => void;
  onRootSelected: () => void;
}

const SYSTEM_DB_NAMES = new Set(["master", "msdb", "tempdb", "model", "distribution", "DWQueue", "DWConfiguration", "DWDiagnostics"]);

/** Color for a database tree label */
function dbColor(name: string, state: string, isSystem: boolean, agName?: string | null): string | undefined {
  // System databases
  if (isSystem) {
    if (name === "master" || name === "msdb") return "#d19a66"; // orange
    if (name === "tempdb") return "#5c6370"; // gray
    return undefined; // default (white)
  }

  // Error states — red
  if (state === "SUSPECT" || state === "EMERGENCY") return "var(--danger)";
  // Offline / Restoring — gray
  if (state === "OFFLINE" || state === "RESTORING") return "#5c6370";
  // ONLINE + in AG — green
  if (state === "ONLINE" && agName) return "var(--success)";
  // ONLINE standalone — default (white)
  if (state === "ONLINE") return undefined;

  return "var(--fg-dim)";
}

/** Icons for tree node types */
const ICO = {
  folder: "📁", server: "🖥️", activity: "�", checklist: "☑️",
  database: "🗄️", agent: "⏱️", lock: "🔒", events: "🔍",
  config: "⚙️", backup: "💾", disk: "💽", querystore: "📋",
};

/** Database icon colored by state — inline SVG cylinder */
function dbIcon(state: string, isSystem: boolean): JSX.Element {
  let fill: string;
  let glow = false;

  if (isSystem) {
    fill = "#d19a66"; // orange for all system DBs
  } else {
    switch (state) {
      case "ONLINE":    fill = "#e5c07b"; break;  // yellow
      case "OFFLINE":   fill = "#5c6370"; break;  // gray
      case "RESTORING": fill = "#89d185"; break;  // green
      case "SUSPECT":   fill = "#f44747"; glow = true; break;
      case "EMERGENCY": fill = "#f44747"; glow = true; break;
      default:          fill = "#5c6370"; break;
    }
  }
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" style={glow ? { filter: "drop-shadow(0 0 3px #f44747)" } : undefined}>
      <ellipse cx="8" cy="4" rx="6" ry="2.5" fill={fill} />
      <path d="M2 4v8c0 1.38 2.69 2.5 6 2.5s6-1.12 6-2.5V4" fill={fill} opacity="0.75" />
      <ellipse cx="8" cy="12" rx="6" ry="2.5" fill={fill} opacity="0.6" />
      <ellipse cx="8" cy="4" rx="6" ry="2.5" fill="none" stroke={fill} strokeWidth="0.5" opacity="0.9" />
    </svg>
  );
}

export function ObjectExplorer({ servers, filter, onContextChange, onServerRemoved, onRootSelected }: Props) {
  const lc = filter.toLowerCase();

  return (
    <div className="tree-root">
      <div
        className="tree-node-label"
        onClick={onRootSelected}
        style={{ fontWeight: 700, marginBottom: 4, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
      >
        <span className="tree-icon">{ICO.folder}</span> Dashboard
      </div>
      {servers.length === 0 && (
        <div style={{ color: "var(--fg-dim)", fontSize: 12, paddingLeft: 16 }}>No servers connected.</div>
      )}
      <div className="tree-children">
        {servers.map((server) => (
          <ServerNode
            key={server}
            server={server}
            filter={lc}
            onContextChange={onContextChange}
            onRemove={() => onServerRemoved(server)}
          />
        ))}
      </div>
    </div>
  );
}

/* ---------- Leaf with icon ---------- */
function IconLeaf({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <div className="tree-node">
      <div className="tree-node-label" onClick={onClick}>
        <span className="tree-icon">{icon}</span> {label}
      </div>
    </div>
  );
}

/* ---------- Server node ---------- */
function ServerNode({
  server,
  filter,
  onContextChange,
  onRemove,
}: {
  server: string;
  filter: string;
  onContextChange: (ctx: TreeContext) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [rev, setRev] = useState(0);

  function toggle() {
    setExpanded((e) => !e);
    onContextChange({ server, view: "overview" });
  }

  function handleRefresh(e: React.MouseEvent) {
    e.stopPropagation();
    setRev((r) => r + 1);
  }

  async function handleDisconnect(e: React.MouseEvent) {
    e.stopPropagation();
    try { await bridge.disconnect(server); } catch { /* ignore */ }
    onRemove();
  }

  const isFiltering = filter.length > 0;
  const serverMatches = server.toLowerCase().includes(filter);
  if (isFiltering && !serverMatches) return null;

  const show = expanded || isFiltering;

  return (
    <div className="tree-node">
      <div className="tree-node-label tree-label-flex" onClick={toggle}>
        <span>{show ? "▾" : "▸"} <span className="tree-icon">{ICO.server}</span> {server}</span>
        <span className="tree-node-actions">
          <button className="tree-btn" onClick={handleRefresh} title="Refresh">↻</button>
          <button className="tree-btn" onClick={handleDisconnect} title="Disconnect">✕</button>
        </span>
      </div>
      {show && (
        <div className="tree-children" key={rev}>
          <IconLeaf icon={ICO.activity} label="Activity" onClick={() => onContextChange({ server, view: "activity" })} />
          <IconLeaf icon={ICO.checklist} label="Always On" onClick={() => onContextChange({ server, view: "alwayson" })} />
          <DatabasesBranch server={server} filter={filter} onContextChange={onContextChange} />
          <IconLeaf icon={ICO.agent} label="Agent" onClick={() => onContextChange({ server, view: "agent" })} />
          <IconLeaf icon={ICO.lock} label="Security" onClick={() => onContextChange({ server, view: "security" })} />
          <IconLeaf icon={ICO.events} label="Extended Events" onClick={() => onContextChange({ server, view: "extendedevents" })} />
        </div>
      )}
    </div>
  );
}

/* ---------- Databases branch (lazy, splits system / user) ---------- */
function DatabasesBranch({
  server,
  filter,
  onContextChange,
}: {
  server: string;
  filter: string;
  onContextChange: (ctx: TreeContext) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [databases, setDatabases] = useState<TreeNode[] | null>(null);
  const [loading, setLoading] = useState(false);

  const loadDatabases = useCallback(async () => {
    setLoading(true);
    try { setDatabases(await bridge.getDatabases(server)); } finally { setLoading(false); }
  }, [server]);

  async function toggle() {
    if (!expanded && databases === null) await loadDatabases();
    setExpanded((e) => !e);
    onContextChange({ server, view: "databases" });
  }

  const isFiltering = filter.length > 0;
  const systemDbs = databases?.filter((db) => SYSTEM_DB_NAMES.has(db.label)) ?? [];
  const userDbs = databases?.filter((db) => !SYSTEM_DB_NAMES.has(db.label)) ?? [];

  const filteredSystem = systemDbs.filter((db) => db.label.toLowerCase().includes(filter));
  const filteredUser = userDbs.filter((db) => db.label.toLowerCase().includes(filter));

  return (
    <div className="tree-node">
      <div className="tree-node-label" onClick={toggle}>
        {expanded || isFiltering ? "▾" : "▸"} <span className="tree-icon">{ICO.folder}</span> Databases
        {databases && <span style={{ color: "var(--fg-dim)", marginLeft: 4 }}>({databases.length})</span>}
      </div>
      {(expanded || isFiltering) && loading && <div className="loading" style={{ paddingLeft: 20 }}>Loading...</div>}
      {(expanded || isFiltering) && databases && (
        <div className="tree-children">
          {/* System Databases folder */}
          <SystemDbsFolder
            databases={isFiltering ? filteredSystem : systemDbs}
            server={server}
            filter={filter}
            onContextChange={onContextChange}
            forceOpen={isFiltering}
          />
          {/* User databases — flat list */}
          {(isFiltering ? filteredUser : userDbs).map((db) => (
            <DatabaseNode key={db.id} node={db} server={server} filter={filter} onContextChange={onContextChange} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- System Databases folder ---------- */
function SystemDbsFolder({
  databases,
  server,
  filter,
  onContextChange,
  forceOpen,
}: {
  databases: TreeNode[];
  server: string;
  filter: string;
  onContextChange: (ctx: TreeContext) => void;
  forceOpen: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  if (databases.length === 0 && !forceOpen) return null;

  const show = expanded || forceOpen;

  return (
    <div className="tree-node">
      <div className="tree-node-label" onClick={() => setExpanded((e) => !e)}>
        {show ? "▾" : "▸"} <span className="tree-icon">{ICO.folder}</span> System Databases
        <span style={{ color: "var(--fg-dim)", marginLeft: 4 }}>({databases.length})</span>
      </div>
      {show && (
        <div className="tree-children">
          {databases.map((db) => (
            <DatabaseNode key={db.id} node={db} server={server} filter={filter} onContextChange={onContextChange} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Database node ---------- */
function DatabaseNode({
  node,
  server,
  filter,
  onContextChange,
}: {
  node: TreeNode;
  server: string;
  filter: string;
  onContextChange: (ctx: TreeContext) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<TreeNode[] | null>(null);

  const state = String(node.meta?.state ?? "ONLINE");
  const isSystem = SYSTEM_DB_NAMES.has(node.label);
  const agName = node.meta?.agName as string | null | undefined;
  const agSyncState = node.meta?.agSyncState as string | null | undefined;
  const color = dbColor(node.label, state, isSystem, agName);

  async function toggle() {
    if (!expanded && children === null) {
      const ch = await bridge.getDatabaseChildren(server, node.label);
      setChildren(ch);
    }
    setExpanded((e) => !e);
    onContextChange({ server, view: "databases", database: node.label });
  }

  return (
    <div className="tree-node">
      <div className="tree-node-label tree-label-flex" onClick={toggle}>
        <span>
          {expanded ? "▾" : "▸"}{" "}
          <span className="tree-icon">{dbIcon(state, isSystem)}</span>{" "}
          <span style={color ? { color } : undefined}>{node.label}</span>
          {agSyncState && (
            <span style={{ color: "var(--fg-dim)", marginLeft: 4, fontSize: 11 }}>({agSyncState})</span>
          )}
        </span>
        {state !== "ONLINE" && (
          <span style={{ color: "var(--fg-dim)", marginLeft: 4, fontSize: 11 }}>({state})</span>
        )}
        <span className="tree-node-actions">
          <button className="tree-btn" onClick={(e) => e.stopPropagation()} title="Refresh">↻</button>
        </span>
      </div>
      {expanded && (
        <div className="tree-children">
          {children && children.map((folder) => (
            <FolderNode key={folder.id} node={folder} server={server} dbName={node.label} filter={filter} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Folder node ---------- */
function FolderNode({
  node,
  server,
  dbName,
  filter,
}: {
  node: TreeNode;
  server: string;
  dbName: string;
  filter: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const isFiltering = filter.length > 0;
  const filtered = node.children?.filter((c) => c.label.toLowerCase().includes(filter));
  if (isFiltering && filtered && filtered.length === 0) return null;

  const displayChildren = isFiltering ? filtered : node.children;

  return (
    <div className="tree-node">
      <div className="tree-node-label" onClick={() => setExpanded((e) => !e)}>
        {expanded || isFiltering ? "▾" : "▸"} {node.label}
        {displayChildren && (
          <span style={{ color: "var(--fg-dim)", marginLeft: 4 }}>({displayChildren.length})</span>
        )}
      </div>
      {(expanded || isFiltering) && displayChildren && (
        <div className="tree-children">
          {displayChildren.map((child) => (
            <ObjectNode key={child.id} node={child} server={server} dbName={dbName} filter={filter} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Leaf / expandable object node ---------- */
const NODE_ICONS: Partial<Record<TreeNodeType, string>> = {
  index: "idx",
  column: "│",
};

function ObjectNode({
  node,
  server,
  dbName,
  filter,
}: {
  node: TreeNode;
  server: string;
  dbName: string;
  filter: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<TreeNode[] | null>(null);
  const isTable = node.type === "table";
  const isFilegroup = node.type === "filegroup";

  async function toggle() {
    if (isTable && !expanded && children === null) {
      const [schema, table] = node.label.split(".");
      const [cols, idxs] = await Promise.all([
        bridge.getTableColumns(server, dbName, schema, table),
        bridge.getTableIndexes(server, dbName, schema, table),
      ]);
      setChildren([
        { id: `${node.id}:cols`, label: "Columns", type: "folder", children: cols },
        { id: `${node.id}:idxs`, label: "Indexes", type: "folder", children: idxs },
      ]);
    }
    if (isFilegroup && !expanded && children === null) {
      const filegroupId = node.meta?.dataSpaceId as number;
      const files = await bridge.getFilegroupFiles(server, dbName, filegroupId);
      setChildren(files);
    }
    setExpanded((e) => !e);
  }

  const icon = NODE_ICONS[node.type] ?? "";

  if (isTable || isFilegroup) {
    return (
      <div className="tree-node">
        <div className="tree-node-label" onClick={toggle}>
          {expanded ? "▾" : "▸"} {icon ? `${icon} ` : ""}{node.label}
        </div>
        {expanded && children && (
          <div className="tree-children">
            {children.map((sub) => (
              <FolderNode key={sub.id} node={sub} server={server} dbName={dbName} filter={filter} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="tree-node">
      <div className="tree-node-label">{icon ? `${icon} ` : ""}{node.label}</div>
    </div>
  );
}
