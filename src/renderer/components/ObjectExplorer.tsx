import { useState, useCallback } from "react";
import { bridge } from "../bridge";
import type { TreeNode, TreeNodeType, TreeContext } from "../../shared/types";

interface Props {
  servers: string[];
  onContextChange: (ctx: TreeContext) => void;
  onServerRemoved: (server: string) => void;
  onRootSelected: () => void;
}

const SYSTEM_DB_NAMES = new Set(["master", "msdb", "tempdb", "model", "distribution", "DWQueue", "DWConfiguration", "DWDiagnostics"]);

/** Folder labels that should have a filter button */
const FILTERABLE_FOLDERS = new Set([
  "Tables", "Views", "Stored Procedures", "Scalar Functions", "Table Valued Functions",
  "Filegroups", "Users", "Roles", "Schemas",
]);

/* --- Spinner icon for loading state --- */
function SpinnerIcon() {
  return <span className="tree-spinner">⟳</span>;
}

/* --- Filter icon button --- */
function FilterButton({ active, onClick }: { active: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      className="tree-btn tree-filter-btn"
      onClick={onClick}
      title={active ? "Clear filter" : "Filter"}
      style={{ color: active ? "#e5c07b" : "var(--fg-dim)" }}
    >
      <svg viewBox="0 0 16 16" width="12" height="12">
        <polygon points="1,1 15,1 10,7 10,13 6,15 6,7" fill={active ? "#e5c07b" : "none"} stroke={active ? "#e5c07b" : "currentColor"} strokeWidth="1.2" />
      </svg>
    </button>
  );
}

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

/* --- Inline SVG icon components --- */

/** Activity: task-manager style — small window with performance bars */
function ActivityIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14">
      <rect x="1" y="2" width="14" height="12" rx="1.5" fill="none" stroke="#6a9" strokeWidth="1.2" />
      <line x1="1" y1="5" x2="15" y2="5" stroke="#6a9" strokeWidth="0.8" />
      <rect x="3.5" y="7" width="2" height="5" rx="0.3" fill="#5b5" />
      <rect x="7" y="9" width="2" height="3" rx="0.3" fill="#7c4" />
      <rect x="10.5" y="6.5" width="2" height="5.5" rx="0.3" fill="#5b5" />
    </svg>
  );
}

/** Always On: computer-cluster style — two linked servers */
function ClusterIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14">
      <rect x="1" y="2" width="5" height="4" rx="0.8" fill="#5588bb" />
      <rect x="10" y="2" width="5" height="4" rx="0.8" fill="#5588bb" />
      <rect x="1" y="10" width="5" height="4" rx="0.8" fill="#5588bb" />
      <rect x="10" y="10" width="5" height="4" rx="0.8" fill="#5588bb" />
      <line x1="6" y1="4" x2="10" y2="4" stroke="#8ab" strokeWidth="0.9" />
      <line x1="6" y1="12" x2="10" y2="12" stroke="#8ab" strokeWidth="0.9" />
      <line x1="3.5" y1="6" x2="3.5" y2="10" stroke="#8ab" strokeWidth="0.9" />
      <line x1="12.5" y1="6" x2="12.5" y2="10" stroke="#8ab" strokeWidth="0.9" />
    </svg>
  );
}

/** Agent: automation/robot — gear with play arrow */
function AgentIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14">
      <circle cx="8" cy="8" r="6" fill="none" stroke="#c89b3c" strokeWidth="1" />
      <circle cx="8" cy="8" r="3.5" fill="none" stroke="#c89b3c" strokeWidth="0.8" />
      {/* Gear teeth */}
      <rect x="7.2" y="1" width="1.6" height="2.2" rx="0.3" fill="#c89b3c" />
      <rect x="7.2" y="12.8" width="1.6" height="2.2" rx="0.3" fill="#c89b3c" />
      <rect x="1" y="7.2" width="2.2" height="1.6" rx="0.3" fill="#c89b3c" />
      <rect x="12.8" y="7.2" width="2.2" height="1.6" rx="0.3" fill="#c89b3c" />
      {/* Play arrow in center */}
      <polygon points="6.8,5.8 6.8,10.2 10.5,8" fill="#c89b3c" />
    </svg>
  );
}

/** Icons for tree node types */
const ICO: Record<string, React.ReactNode> = {
  folder: "📁", server: "🖥️", activity: <ActivityIcon />, checklist: <ClusterIcon />,
  database: "🗄️", agent: <AgentIcon />, lock: "🛡️", events: "🔍",
  config: "⚙️", backup: "💾", disk: "💽", querystore: "📊",
  security: "🛡️", storage: "💾",
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

export function ObjectExplorer({ servers, onContextChange, onServerRemoved, onRootSelected }: Props) {
  return (
    <div className="tree-root">
      <div
        className="tree-node-label tree-clickable"
        onClick={onRootSelected}
        style={{ fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}
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
            onContextChange={onContextChange}
            onRemove={() => onServerRemoved(server)}
          />
        ))}
      </div>
      <ToolsBranch />
    </div>
  );
}

/* ---------- Leaf with icon (opens a panel) ---------- */
function IconLeaf({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <div className="tree-node">
      <div className="tree-node-label tree-clickable" onClick={onClick}>
        <span className="tree-icon">{icon}</span> {label}
      </div>
    </div>
  );
}

/* ---------- Tools branch (root-level) ---------- */
function ToolsBranch() {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="tree-node" style={{ marginTop: 8 }}>
      <div className="tree-node-label" onClick={() => setExpanded(!expanded)}>
        <span className="tree-toggle">{expanded ? "▾" : "▸"}</span>
        <span className="tree-icon">🧰</span> Tools
      </div>
      {expanded && (
        <div className="tree-children">
          <div className="tree-node">
            <div className="tree-node-label">
              <span className="tree-icon">📦</span> Common
            </div>
          </div>
          <div className="tree-node">
            <div className="tree-node-label">
              <span className="tree-icon">🤖</span> AI
            </div>
          </div>
          <div className="tree-node">
            <div className="tree-node-label">
              <span className="tree-icon">📜</span> Scripting
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Server node ---------- */
function ServerNode({
  server,
  onContextChange,
  onRemove,
}: {
  server: string;
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

  return (
    <div className="tree-node">
      <div className="tree-node-label tree-label-flex tree-clickable" onClick={toggle}>
        <span>{expanded ? "▾" : "▸"} <span className="tree-icon">{ICO.server}</span> {server}</span>
        <span className="tree-node-actions">
          <button className="tree-btn" onClick={handleRefresh} title="Refresh">↻</button>
          <button className="tree-btn" onClick={handleDisconnect} title="Disconnect">✕</button>
        </span>
      </div>
      {expanded && (
        <div className="tree-children" key={rev}>
          <IconLeaf icon={ICO.activity} label="Activity" onClick={() => onContextChange({ server, view: "activity" })} />
          <IconLeaf icon={ICO.checklist} label="Always On" onClick={() => onContextChange({ server, view: "alwayson" })} />
          <DatabasesBranch server={server} onContextChange={onContextChange} />
          <IconLeaf icon={ICO.agent} label="Agent" onClick={() => onContextChange({ server, view: "agent" })} />
          <IconLeaf icon={ICO.security} label="Security" onClick={() => onContextChange({ server, view: "security" })} />
          <IconLeaf icon={ICO.events} label="Extended Events" onClick={() => onContextChange({ server, view: "extendedevents" })} />
        </div>
      )}
    </div>
  );
}

/* ---------- Databases branch (lazy, splits system / user) ---------- */
function DatabasesBranch({
  server,
  onContextChange,
}: {
  server: string;
  onContextChange: (ctx: TreeContext) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [databases, setDatabases] = useState<TreeNode[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterText, setFilterText] = useState("");

  const loadDatabases = useCallback(async () => {
    setLoading(true);
    try { setDatabases(await bridge.getDatabases(server)); } finally { setLoading(false); }
  }, [server]);

  async function toggle() {
    if (!expanded && databases === null) await loadDatabases();
    setExpanded((e) => !e);
    onContextChange({ server, view: "databases" });
  }

  function handleFilterClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (filterText) { setFilterText(""); setFilterOpen(false); }
    else setFilterOpen((v) => !v);
  }

  const lc = filterText.toLowerCase();
  const systemDbs = databases?.filter((db) => SYSTEM_DB_NAMES.has(db.label)) ?? [];
  const userDbs = databases?.filter((db) => !SYSTEM_DB_NAMES.has(db.label)) ?? [];
  const filteredSystem = lc ? systemDbs.filter((db) => db.label.toLowerCase().includes(lc)) : systemDbs;
  const filteredUser = lc ? userDbs.filter((db) => db.label.toLowerCase().includes(lc)) : userDbs;

  return (
    <div className="tree-node">
      <div className="tree-node-label tree-label-flex tree-clickable" onClick={toggle}>
        <span>
          {loading ? <SpinnerIcon /> : (expanded ? "▾" : "▸")}{" "}
          <span className="tree-icon">{ICO.folder}</span> Databases
          {databases && <span style={{ color: "var(--fg-dim)", marginLeft: 4 }}>({databases.length})</span>}
        </span>
        <span className="tree-node-actions">
          <FilterButton active={!!filterText} onClick={handleFilterClick} />
        </span>
      </div>
      {filterOpen && (
        <div className="tree-filter-input" onClick={(e) => e.stopPropagation()}>
          <input
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter databases..."
            autoFocus
            onKeyDown={(e) => { if (e.key === "Escape") { setFilterText(""); setFilterOpen(false); } }}
          />
        </div>
      )}
      {expanded && loading && <div className="loading" style={{ paddingLeft: 20 }}>Loading...</div>}
      {expanded && databases && (
        <div className="tree-children">
          <SystemDbsFolder
            databases={filteredSystem}
            server={server}
            onContextChange={onContextChange}
          />
          {filteredUser.map((db) => (
            <DatabaseNode key={db.id} node={db} server={server} onContextChange={onContextChange} />
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
  onContextChange,
}: {
  databases: TreeNode[];
  server: string;
  onContextChange: (ctx: TreeContext) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (databases.length === 0) return null;

  return (
    <div className="tree-node">
      <div className="tree-node-label" onClick={() => setExpanded((e) => !e)}>
        {expanded ? "▾" : "▸"} <span className="tree-icon">{ICO.folder}</span> System Databases
        <span style={{ color: "var(--fg-dim)", marginLeft: 4 }}>({databases.length})</span>
      </div>
      {expanded && (
        <div className="tree-children">
          {databases.map((db) => (
            <DatabaseNode key={db.id} node={db} server={server} onContextChange={onContextChange} />
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
  onContextChange,
}: {
  node: TreeNode;
  server: string;
  onContextChange: (ctx: TreeContext) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<TreeNode[] | null>(null);
  const [loading, setLoading] = useState(false);

  const state = String(node.meta?.state ?? "ONLINE");
  const isSystem = SYSTEM_DB_NAMES.has(node.label);
  const agName = node.meta?.agName as string | null | undefined;
  const agSyncState = node.meta?.agSyncState as string | null | undefined;
  const color = dbColor(node.label, state, isSystem, agName);

  async function toggle() {
    if (!expanded && children === null) {
      setLoading(true);
      try {
        const ch = await bridge.getDatabaseChildren(server, node.label);
        setChildren(ch);
      } finally {
        setLoading(false);
      }
    }
    setExpanded((e) => !e);
    onContextChange({ server, view: "databases", database: node.label });
  }

  return (
    <div className="tree-node">
      <div className="tree-node-label tree-label-flex tree-clickable" onClick={toggle}>
        <span>
          {loading ? <SpinnerIcon /> : (expanded ? "▾" : "▸")}{" "}
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
            <FolderNode key={folder.id} node={folder} server={server} dbName={node.label} onContextChange={onContextChange} />
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
  onContextChange,
}: {
  node: TreeNode;
  server: string;
  dbName: string;
  onContextChange: (ctx: TreeContext) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterText, setFilterText] = useState("");
  const isFilterable = FILTERABLE_FOLDERS.has(node.label);

  function handleFilterClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (filterText) { setFilterText(""); setFilterOpen(false); }
    else setFilterOpen((v) => !v);
  }

  const lc = filterText.toLowerCase();
  const displayChildren = lc
    ? node.children?.filter((c) => c.label.toLowerCase().includes(lc))
    : node.children;

  return (
    <div className="tree-node">
      <div className="tree-node-label tree-label-flex" onClick={() => setExpanded((e) => !e)}>
        <span>
          {expanded ? "▾" : "▸"} {node.label}
          {displayChildren && (
            <span style={{ color: "var(--fg-dim)", marginLeft: 4 }}>({displayChildren.length})</span>
          )}
        </span>
        {isFilterable && (
          <span className="tree-node-actions">
            <FilterButton active={!!filterText} onClick={handleFilterClick} />
          </span>
        )}
      </div>
      {filterOpen && (
        <div className="tree-filter-input" onClick={(e) => e.stopPropagation()}>
          <input
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder={`Filter ${node.label.toLowerCase()}...`}
            autoFocus
            onKeyDown={(e) => { if (e.key === "Escape") { setFilterText(""); setFilterOpen(false); } }}
          />
        </div>
      )}
      {expanded && displayChildren && (
        <div className="tree-children">
          {displayChildren.map((child) => (
            <ObjectNode key={child.id} node={child} server={server} dbName={dbName} onContextChange={onContextChange} />
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
  onContextChange,
}: {
  node: TreeNode;
  server: string;
  dbName: string;
  onContextChange: (ctx: TreeContext) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<TreeNode[] | null>(null);
  const [loading, setLoading] = useState(false);
  const isTable = node.type === "table";
  const isView = node.type === "view";
  const isFilegroup = node.type === "filegroup";
  const isProcedure = node.type === "procedure";
  const isFunction = node.type === "function";
  const isTrigger = node.type === "trigger";
  const opensPanel = isTable || isView || isProcedure || isFunction || isTrigger;

  async function toggle() {
    if (isTable && !expanded && children === null) {
      setLoading(true);
      try {
        const [schema, table] = node.label.split(".");
        const [cols, idxs] = await Promise.all([
          bridge.getTableColumns(server, dbName, schema, table),
          bridge.getTableIndexes(server, dbName, schema, table),
        ]);
        setChildren([
          { id: `${node.id}:cols`, label: "Columns", type: "folder", children: cols },
          { id: `${node.id}:idxs`, label: "Indexes", type: "folder", children: idxs },
        ]);
      } finally {
        setLoading(false);
      }
    }
    if (isFilegroup && !expanded && children === null) {
      setLoading(true);
      try {
        const filegroupId = node.meta?.dataSpaceId as number;
        const files = await bridge.getFilegroupFiles(server, dbName, filegroupId);
        setChildren(files);
      } finally {
        setLoading(false);
      }
    }
    setExpanded((e) => !e);

    if (isTable || isView) {
      const schema = (node.meta?.schema as string) ?? node.label.split(".")[0];
      const objName = node.label.split(".").pop()!;
      onContextChange({ server, view: "table", database: dbName, schema, objectName: objName });
    }
    if (isProcedure || isFunction || isTrigger) {
      const parts = node.label.split(".");
      onContextChange({ server, view: "sqlmodule", database: dbName, schema: parts[0], objectName: parts.pop()!, objectType: node.type });
    }
  }

  const icon = NODE_ICONS[node.type] ?? "";

  if (isTable || isFilegroup) {
    return (
      <div className="tree-node">
        <div className={`tree-node-label${opensPanel ? " tree-clickable" : ""}`} onClick={toggle}>
          {loading ? <SpinnerIcon /> : (expanded ? "▾" : "▸")} {icon ? `${icon} ` : ""}{node.label}
        </div>
        {expanded && children && (
          <div className="tree-children">
            {children.map((sub) => (
              <FolderNode key={sub.id} node={sub} server={server} dbName={dbName} onContextChange={onContextChange} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (opensPanel) {
    return (
      <div className="tree-node">
        <div className="tree-node-label tree-clickable" onClick={toggle}>
          {icon ? `${icon} ` : ""}{node.label}
        </div>
      </div>
    );
  }

  return (
    <div className="tree-node">
      <div className="tree-node-label">{icon ? `${icon} ` : ""}{node.label}</div>
    </div>
  );
}
