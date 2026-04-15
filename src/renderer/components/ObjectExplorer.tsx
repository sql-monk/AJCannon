import { useState, useCallback, useRef } from "react";
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

/* --- Iconify SVG icons (24x24 viewBox, rendered at 16x16) --- */
const IcoSize = { width: 16, height: 16 };

function IcoActivity() {
  return <svg xmlns="http://www.w3.org/2000/svg" {...IcoSize} viewBox="0 0 24 24"><path fill="currentColor" d="M20 3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2M4 19V8h16V5v14z" /><path fill="currentColor" d="m14.11 13.55l-.61 1.21l-2.11-4.21c-.34-.68-1.45-.68-1.79 0L8.38 13H6v2h3c.38 0 .72-.21.89-.55l.61-1.21l2.11 4.21c.17.34.52.55.89.55s.72-.21.89-.55L15.61 15h2.38v-2h-3c-.38 0-.72.21-.89.55Z" /></svg>;
}
function IcoServer() {
  return <svg xmlns="http://www.w3.org/2000/svg" {...IcoSize} viewBox="0 0 128 128"><path fill="#d1d1d1" d="M51.395 24.879c-27.422 0-49.649-3.832-49.649-8.535v92.261c0 4.727 22.227 8.536 49.649 8.536c27.421 0 49.648-3.832 49.648-8.536V16.29c0 4.758-22.227 8.59-49.648 8.59Zm0 0" /><path fill="#adadad" d="M1.746 16.29v92.315c0 4.727 22.227 8.536 49.649 8.536V24.879c-27.422 0-49.649-3.832-49.649-8.59Zm92.317 4.405v92.262c4.425-1.277 6.98-2.777 6.98-4.375V16.289c0 1.633-2.547 3.106-6.98 4.406m0 0" /><path fill="#939699" d="M101.043 16.313c0-4.723-22.23-8.555-49.648-8.555c-27.422 0-49.649 3.832-49.649 8.555c0 4.726 22.227 8.558 49.649 8.558c27.417 0 49.648-3.832 49.648-8.558M1.746 74.332c0 4.727 22.227 8.535 49.649 8.535c27.421 0 49.648-3.832 49.648-8.535v6.984c0 4.723-22.227 8.532-49.648 8.532S1.746 86.016 1.746 81.316Zm0-30.75c0 4.723 22.227 8.535 49.649 8.535c27.421 0 49.648-3.836 49.648-8.535v6.98c0 4.727-22.227 8.536-49.648 8.536S1.746 55.266 1.746 50.563Zm0 0" /><path fill="#ecedf0" d="M126.64 93.09c0 16.281-13.195 29.48-29.476 29.48s-29.48-13.199-29.48-29.48s13.199-29.477 29.48-29.477s29.477 13.196 29.477 29.477Zm0 0" /><path fill="#3faa00" d="M123.004 93.09c0 14.273-11.57 25.84-25.84 25.84c-14.273 0-25.84-11.567-25.84-25.84c0-14.27 11.567-25.84 25.84-25.84c14.27 0 25.84 11.57 25.84 25.84m0 0" /><path fill="#fff" d="m88.063 105.906l24.027-13.87l-24.028-13.872Zm0 0" /></svg>;
}
function IcoAlwaysOn() {
  return <svg xmlns="http://www.w3.org/2000/svg" {...IcoSize} viewBox="0 0 2048 2048"><path fill="currentColor" d="M252 569q-32-12-63-26t-61-33v706q0 19 14 37t35 33t43 26t36 18v136q-41-15-86-37t-83-52t-62-71t-25-90V320q0-48 22-86t60-70t84-54t96-41t96-29t84-18Q570 0 704 0q47 0 110 4t133 16t140 29t131 47t107 66t69 90q-50-9-99-15t-100-10q-51-28-112-47t-127-30t-130-17t-122-5q-58 0-129 5t-143 20t-138 37t-115 59q-17 12-34 30t-17 41q0 26 24 48t56 41t66 32t53 19q-23 24-42 51t-33 58m836 455q-68 0-144-6t-153-22t-149-41t-130-61v706q0 23 18 44t48 38t66 32t72 26t64 18t46 11q49 9 98 14t100 8v128q-44-2-108-9t-136-22t-142-39t-127-59t-92-82t-35-108V704q0-47 22-86t58-69t83-54t95-41t96-29t83-18q66-12 133-17t134-6q67 0 134 5t133 18q36 7 83 18t95 28t95 41t83 54t59 70t22 86v320h-128V894q-59 36-130 61t-148 40t-153 22t-145 7m0-512q-57 0-130 6t-148 20t-143 40t-115 63q-14 11-27 27t-13 36q0 19 13 35t27 28q46 38 114 63t143 39t148 21t131 6q57 0 130-6t148-20t143-40t114-63q14-11 27-27t14-36q0-19-13-35t-28-28q-46-38-114-63t-142-39t-148-21t-131-6m832 640h128v384h-384v-128h190q-45-60-112-94t-142-34q-59 0-111 20t-95 55t-70 85t-38 107l-127-22q14-81 54-149t98-118t133-78t156-28q91 0 174 35t146 102zm-320 768q59 0 111-20t95-55t70-85t39-107l126 22q-14 81-54 149t-98 118t-133 78t-156 28q-91 0-174-35t-146-102v137h-128v-384h384v128h-190q45 60 112 94t142 34"/></svg>;
}
function IcoAgent() {
  return <svg xmlns="http://www.w3.org/2000/svg" {...IcoSize} viewBox="0 0 20 20"><path fill="currentColor" d="M6 3a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h3.051A2.5 2.5 0 0 1 9 16.5V16H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1.126q.522.09 1 .239V6a3 3 0 0 0-3-3zm11 5.421a6.4 6.4 0 0 0-1-.279A8 8 0 0 0 14.5 8C12.015 8 10 9.12 10 10.5s2.015 2.5 4.5 2.5s4.5-1.12 4.5-2.5c0-.867-.794-1.63-2-2.079M9 11.25a.5.5 0 0 0-.354.146l-1.412 1.412l-.397-.362a.5.5 0 0 0-.674.738l.75.685a.5.5 0 0 0 .69-.015L9 12.457zm.354-4.146a.5.5 0 0 0-.708-.708L7.234 7.808l-.397-.362a.5.5 0 0 0-.674.738l.75.685a.5.5 0 0 0 .69-.016zM14.5 14c1.38 0 2.678-.309 3.668-.858c.293-.163.578-.36.833-.59L19 16.5c0 1.381-2.015 2.5-4.5 2.5S10 17.88 10 16.5v-3.945c.255.23.54.425.832.588c.99.55 2.288.858 3.668.858" /></svg>;
}
function IcoSecurity() {
  return <svg xmlns="http://www.w3.org/2000/svg" {...IcoSize} viewBox="0 0 48 48"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" d="m29.42 27.678l9.498-3.752c2.126-.84 2.75-.598 3.742.145c.561.42.766.93.817 1.56c.106 1.311-.145 2.161-.986 2.727c-5.099 3.429-10.534 5.984-17.348 8.785c-3.312 1.361-8.21.463-12.61-1.05L6.64 36.07a2.136 2.136 0 0 1-2.14-2.132v-5.962c0-1.186.955-2.14 2.14-2.14h6.326c2.407-2.992 9.734-1.995 14.92-1.819c1.4.048 1.924 1.489 1.534 3.661c-1.348 2.587-4.775 1.902-8 2.019m8.082-11.317l1.234-1.234l1.233 1.233m-5.912 0l1.234-1.233h0l1.233 1.233m-5.867-5.069h9.717l2.726 2.535l-2.726 2.535h-.404m-2.467 0h-.978m-2.467 0h-3.4m-4.305-2.535c0 .864-.7 1.565-1.565 1.565h-.001c-.864 0-1.565-.7-1.565-1.565h0c0-.864.7-1.565 1.565-1.565h0c.864 0 1.566.7 1.566 1.564zm4.304 2.534l-2.464 2.464c-.9.9-2.348.9-3.247 0L13.57 17.47c-.9-.9-.9-2.348 0-3.248l3.375-3.375c.9-.9 2.348-.9 3.247 0h0l2.464 2.464" strokeWidth="1" /></svg>;
}
function IcoExtEvents() {
  return <svg xmlns="http://www.w3.org/2000/svg" {...IcoSize} viewBox="0 0 32 32"><path fill="currentColor" d="M11.63 8h7.38v2h-7.38z" /><path fill="currentColor" d="M7 8h3.19v2H7z" /><path fill="currentColor" d="M7 16h7.38v2H7z" /><path fill="currentColor" d="M15.81 16H19v2h-3.19zM7 12h9v2H7z" /><path fill="currentColor" d="M13 0C5.82 0 0 5.82 0 13s5.82 13 13 13s13-5.82 13-13A13 13 0 0 0 13 0m0 24C6.925 24 2 19.075 2 13S6.925 2 13 2s11 4.925 11 11s-4.925 11-11 11m9.581-.007l1.414-1.414l7.708 7.708l-1.414 1.414z" /></svg>;
}
function IcoTable() {
  return <svg xmlns="http://www.w3.org/2000/svg" {...IcoSize} viewBox="0 0 24 24"><g fill="none"><path d="m12.593 23.258l-.011.002l-.071.035l-.02.004l-.014-.004l-.071-.035q-.016-.005-.024.005l-.004.01l-.017.428l.005.02l.01.013l.104.074l.015.004l.012-.004l.104-.074l.012-.016l.004-.017l-.017-.427q-.004-.016-.017-.018m.265-.113l-.013.002l-.185.093l-.01.01l-.003.011l.018.43l.005.012l.008.007l.201.093q.019.005.029-.008l.004-.014l-.034-.614q-.005-.018-.02-.022m-.715.002a.02.02 0 0 0-.027.006l-.006.014l-.034.614q.001.018.017.024l.015-.002l.201-.093l.01-.008l.004-.011l.017-.43l-.003-.012l-.01-.01z" /><path fill="currentColor" d="M19 3a2 2 0 0 1 1.995 1.85L21 5v14a2 2 0 0 1-1.85 1.995L19 21H5a2 2 0 0 1-1.995-1.85L3 19V5a2 2 0 0 1 1.85-1.995L5 3zm-8 12H5v4h6zm8 0h-6v4h6zm0-5h-6v3h6zm-8 0H5v3h6zm8-5h-6v3h6zm-8 0H5v3h6z" /></g></svg>;
}
function IcoView() {
  return <svg xmlns="http://www.w3.org/2000/svg" {...IcoSize} viewBox="0 0 24 24"><path fill="currentColor" d="M17 16.88c.56 0 1 .44 1 1s-.44 1-1 1s-1-.45-1-1s.44-1 1-1m0-3c2.73 0 5.06 1.66 6 4c-.94 2.34-3.27 4-6 4s-5.06-1.66-6-4c.94-2.34 3.27-4 6-4m0 1.5a2.5 2.5 0 0 0 0 5a2.5 2.5 0 0 0 0-5M18 3H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5.42c-.16-.32-.3-.66-.42-1c.12-.34.26-.68.42-1H4v-4h6v2.97c.55-.86 1.23-1.6 2-2.21V13h1.15c1.16-.64 2.47-1 3.85-1c1.06 0 2.07.21 3 .59V5c0-1.1-.9-2-2-2m-8 8H4V7h6zm8 0h-6V7h6z" /></svg>;
}
function IcoScript() {
  return <svg xmlns="http://www.w3.org/2000/svg" {...IcoSize} viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15.25 21.25H4A2.25 2.25 0 0 1 1.75 19v-1.25a1.5 1.5 0 0 1 1.5-1.5h1.5m10.5 5a2.5 2.5 0 0 0 2.5-2.5v-11m-2.5 13.5a2.5 2.5 0 0 1-2.5-2.5v-1.5a1 1 0 0 0-1-1h-7m15.376-13.5H8.25a3.5 3.5 0 0 0-3.5 3.5v10m13-8.5h3.5a1 1 0 0 0 1-1V5a2.25 2.25 0 0 0-4.5 0zm-9.25-.5h6m-6 4h4" /></svg>;
}
function IcoFolder() {
  return <svg xmlns="http://www.w3.org/2000/svg" {...IcoSize} viewBox="0 0 24 24"><path fill="currentColor" d="M3.5 6.25V8h4.629a.75.75 0 0 0 .53-.22l1.53-1.53l-1.53-1.53a.75.75 0 0 0-.53-.22H5.25A1.75 1.75 0 0 0 3.5 6.25m-1.5 0A3.25 3.25 0 0 1 5.25 3h2.879a2.25 2.25 0 0 1 1.59.659L11.562 5.5h7.189A3.25 3.25 0 0 1 22 8.75v9A3.25 3.25 0 0 1 18.75 21H5.25A3.25 3.25 0 0 1 2 17.75zM3.5 9.5v8.25c0 .966.784 1.75 1.75 1.75h13.5a1.75 1.75 0 0 0 1.75-1.75v-9A1.75 1.75 0 0 0 18.75 7h-7.19L9.72 8.841a2.25 2.25 0 0 1-1.591.659z"/></svg>;
}
function IcoStorage() {
  return <svg xmlns="http://www.w3.org/2000/svg" {...IcoSize} viewBox="0 0 16 16"><g fill="currentColor" fillRule="evenodd" transform="translate(0 2)"><path fillRule="nonzero" d="M2 6a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1zm13 2v3a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1m1-3V2a2 2 0 0 0-2-2H2a2 2 0 0 0-2 2v3c0 .601.271 1.133.69 1.5C.271 6.867 0 7.399 0 8v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8c0-.601-.271-1.133-.689-1.5c.418-.367.689-.899.689-1.5" /><circle cx="4.5" cy="9.5" r="1.5" /><circle cx="4.5" cy="3.5" r="1.5" /><path d="M12 8h1v3h-1zm-2 0h1v3h-1zm2-6h1v3h-1zm-2 0h1v3h-1z" /></g></svg>;
}
function IcoQueryStore() {
  return <svg xmlns="http://www.w3.org/2000/svg" {...IcoSize} viewBox="0 0 24 24"><path fill="currentColor" d="M2.625 14.025L1 12.85l5-8l3 3.5l4-6.5l3 4.5L19.375 1L21 2.175l-4.95 7.85l-2.975-4.475l-3.8 6.175L6.25 8.2zM14.5 18q1.05 0 1.775-.725T17 15.5t-.725-1.775T14.5 13t-1.775.725T12 15.5t.725 1.775T14.5 18m5.1 4l-2.7-2.7q-.525.35-1.137.525T14.5 20q-1.875 0-3.187-1.312T10 15.5t1.313-3.187T14.5 11t3.188 1.313T19 15.5q0 .65-.175 1.263T18.3 17.9l2.7 2.7z" /></svg>;
}

/** Map of node/folder type → icon component */
function nodeIcon(type: string): React.ReactNode {
  switch (type) {
    case "activity":  return <IcoActivity />;
    case "server":    return <IcoServer />;
    case "alwayson":  return <IcoAlwaysOn />;
    case "agent":     return <IcoAgent />;
    case "security":  return <IcoSecurity />;
    case "events":    return <IcoExtEvents />;
    case "table":     return <IcoTable />;
    case "view":      return <IcoView />;
    case "procedure":
    case "function":
    case "trigger":
    case "script":    return <IcoScript />;
    case "folder":    return <IcoFolder />;
    case "storage":   return <IcoStorage />;
    case "querystore": return <IcoQueryStore />;
    default:          return <IcoFolder />;
  }
}

/** Map db-level folder label → specific icon */
function folderLabelIcon(label: string): React.ReactNode {
  switch (label) {
    case "Security": return <IcoScript />;
    case "Storage":  return <IcoStorage />;
    case "Query Store": return <IcoQueryStore />;
    default: return <IcoFolder />;
  }
}

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

/** Color for a database tree label */
function dbColor(name: string, state: string, isSystem: boolean, agName?: string | null): string | undefined {
  if (isSystem) {
    if (name === "master" || name === "msdb") return "#d19a66";
    if (name === "tempdb") return "#5c6370";
    return undefined;
  }
  if (state === "SUSPECT" || state === "EMERGENCY") return "var(--danger)";
  if (state === "OFFLINE" || state === "RESTORING") return "#5c6370";
  if (state === "ONLINE" && agName) return "var(--success)";
  if (state === "ONLINE") return undefined;
  return "var(--fg-dim)";
}

/* --- Color picker for server --- */
function ColorButton({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  return (
    <label className="tree-btn" title="Server color" style={{ position: "relative", cursor: "pointer" }}>
      <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: color, border: "1px solid var(--border)" }} />
      <input
        type="color"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
      />
    </label>
  );
}

/** Persisted server color in localStorage */
function getServerColor(server: string): string {
  return localStorage.getItem(`AJCannon:server-color:${server}`) ?? "#0e639c";
}
function saveServerColor(server: string, color: string) {
  localStorage.setItem(`AJCannon:server-color:${server}`, color);
}

/* ========== Shared selection context ========== */
interface SelectionCtx {
  selectedId: string | null;
  onSelect: (id: string, ctx: TreeContext) => void;
}

export function ObjectExplorer({ servers, onContextChange, onServerRemoved, onRootSelected }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const treeRef = useRef<HTMLDivElement>(null);

  function handleSelect(id: string, ctx: TreeContext) {
    setSelectedId(id);
    onContextChange(ctx);
  }

  function handleBlur(e: React.FocusEvent) {
    if (treeRef.current && !treeRef.current.contains(e.relatedTarget as Node)) {
      setSelectedId(null);
    }
  }

  const sel: SelectionCtx = { selectedId, onSelect: handleSelect };

  return (
    <div className="tree-root" ref={treeRef} tabIndex={-1} onBlur={handleBlur}>
      <div
        className={`tree-node-label tree-clickable${selectedId === "root" ? " tree-selected" : ""}`}
        onClick={() => { setSelectedId("root"); onRootSelected(); }}
        style={{ fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}
      >
        <span className="tree-icon"><IcoFolder /></span> Dashboard
      </div>
      {servers.length === 0 && (
        <div style={{ color: "var(--fg-dim)", fontSize: 12, paddingLeft: 16 }}>No servers connected.</div>
      )}
      <div className="tree-children">
        {servers.map((server) => (
          <ServerNode
            key={server}
            server={server}
            sel={sel}
            onRemove={() => onServerRemoved(server)}
          />
        ))}
      </div>
      <ToolsBranch />
    </div>
  );
}

/* ---------- Leaf with icon — select only, no expand ---------- */
function IconLeaf({ id, icon, label, sel, ctx }: {
  id: string; icon: React.ReactNode; label: string; sel: SelectionCtx; ctx: TreeContext;
}) {
  return (
    <div className="tree-node">
      <div
        className={`tree-node-label tree-clickable${sel.selectedId === id ? " tree-selected" : ""}`}
        onClick={() => sel.onSelect(id, ctx)}
      >
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
          <div className="tree-node"><div className="tree-node-label"><span className="tree-icon">📦</span> Common</div></div>
          <div className="tree-node"><div className="tree-node-label"><span className="tree-icon">🤖</span> AI</div></div>
          <div className="tree-node"><div className="tree-node-label"><span className="tree-icon">📜</span> Scripting</div></div>
        </div>
      )}
    </div>
  );
}

/* ---------- Server node — expand and select are separate ---------- */
function ServerNode({ server, sel, onRemove }: {
  server: string; sel: SelectionCtx; onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [rev, setRev] = useState(0);
  const [color, setColor] = useState(() => getServerColor(server));
  const nodeId = `srv:${server}`;

  function handleExpand(e: React.MouseEvent) {
    // Only toggle expansion (do NOT fire selection)
    e.stopPropagation();
    setExpanded((prev) => !prev);
  }

  function handleSelect() {
    sel.onSelect(nodeId, { server, view: "overview" });
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

  function handleColorChange(c: string) {
    setColor(c);
    saveServerColor(server, c);
  }

  return (
    <div className="tree-node">
      <div className={`tree-node-label tree-label-flex tree-clickable${sel.selectedId === nodeId ? " tree-selected" : ""}`}>
        <span onClick={handleSelect} style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
          <span className="tree-toggle" onClick={handleExpand}>{expanded ? "▾" : "▸"}</span>
          <span className="tree-icon" style={{ color }}><IcoServer /></span>
          <span>{server}</span>
        </span>
        <span className="tree-node-actions">
          <ColorButton color={color} onChange={handleColorChange} />
          <button className="tree-btn" onClick={handleRefresh} title="Refresh">↻</button>
          <button className="tree-btn" onClick={handleDisconnect} title="Disconnect">✕</button>
        </span>
      </div>
      {expanded && (
        <div className="tree-children" key={rev}>
          <IconLeaf id={`${nodeId}:activity`} icon={<IcoActivity />} label="Activity" sel={sel} ctx={{ server, view: "activity" }} />
          <IconLeaf id={`${nodeId}:alwayson`} icon={<IcoAlwaysOn />} label="Always On" sel={sel} ctx={{ server, view: "alwayson" }} />
          <DatabasesBranch server={server} sel={sel} />
          <IconLeaf id={`${nodeId}:agent`} icon={<IcoAgent />} label="Agent" sel={sel} ctx={{ server, view: "agent" }} />
          <IconLeaf id={`${nodeId}:security`} icon={<IcoSecurity />} label="Security" sel={sel} ctx={{ server, view: "security" }} />
          <IconLeaf id={`${nodeId}:events`} icon={<IcoExtEvents />} label="Extended Events" sel={sel} ctx={{ server, view: "extendedevents" }} />
        </div>
      )}
    </div>
  );
}

/* ---------- Databases branch (lazy, splits system / user) ---------- */
function DatabasesBranch({ server, sel }: { server: string; sel: SelectionCtx }) {
  const [expanded, setExpanded] = useState(false);
  const [databases, setDatabases] = useState<TreeNode[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterText, setFilterText] = useState("");
  const nodeId = `srv:${server}:databases`;

  const loadDatabases = useCallback(async () => {
    setLoading(true);
    try { setDatabases(await bridge.getDatabases(server)); } finally { setLoading(false); }
  }, [server]);

  async function handleExpand(e: React.MouseEvent) {
    e.stopPropagation();
    if (!expanded && databases === null) await loadDatabases();
    setExpanded((prev) => !prev);
  }

  function handleSelect() {
    sel.onSelect(nodeId, { server, view: "databases" });
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
      <div className={`tree-node-label tree-label-flex tree-clickable${sel.selectedId === nodeId ? " tree-selected" : ""}`}>
        <span onClick={handleSelect} style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
          <span className="tree-toggle" onClick={handleExpand}>
            {loading ? <SpinnerIcon /> : (expanded ? "▾" : "▸")}
          </span>
          <span className="tree-icon"><IcoFolder /></span> Databases
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
          <SystemDbsFolder databases={filteredSystem} server={server} sel={sel} />
          {filteredUser.map((db) => (
            <DatabaseNode key={db.id} node={db} server={server} sel={sel} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- System Databases folder ---------- */
function SystemDbsFolder({ databases, server, sel }: {
  databases: TreeNode[]; server: string; sel: SelectionCtx;
}) {
  const [expanded, setExpanded] = useState(false);
  if (databases.length === 0) return null;

  return (
    <div className="tree-node">
      <div className="tree-node-label" onClick={() => setExpanded((e) => !e)}>
        {expanded ? "▾" : "▸"} <span className="tree-icon"><IcoFolder /></span> System Databases
        <span style={{ color: "var(--fg-dim)", marginLeft: 4 }}>({databases.length})</span>
      </div>
      {expanded && (
        <div className="tree-children">
          {databases.map((db) => (
            <DatabaseNode key={db.id} node={db} server={server} sel={sel} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Database node — expand and select are separate ---------- */
function DatabaseNode({ node, server, sel }: {
  node: TreeNode; server: string; sel: SelectionCtx;
}) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<TreeNode[] | null>(null);
  const [loading, setLoading] = useState(false);
  const nodeId = `db:${server}:${node.label}`;

  const state = String(node.meta?.state ?? "ONLINE");
  const isSystem = SYSTEM_DB_NAMES.has(node.label);
  const agName = node.meta?.agName as string | null | undefined;
  const agSyncState = node.meta?.agSyncState as string | null | undefined;
  const color = dbColor(node.label, state, isSystem, agName);

  async function handleExpand(e: React.MouseEvent) {
    e.stopPropagation();
    if (!expanded && children === null) {
      setLoading(true);
      try { setChildren(await bridge.getDatabaseChildren(server, node.label)); } finally { setLoading(false); }
    }
    setExpanded((prev) => !prev);
  }

  function handleSelect() {
    sel.onSelect(nodeId, { server, view: "databases", database: node.label });
  }

  return (
    <div className="tree-node">
      <div className={`tree-node-label tree-label-flex tree-clickable${sel.selectedId === nodeId ? " tree-selected" : ""}`}>
        <span onClick={handleSelect} style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
          <span className="tree-toggle" onClick={handleExpand}>
            {loading ? <SpinnerIcon /> : (expanded ? "▾" : "▸")}
          </span>
          <span className="tree-icon">{dbIcon(state, isSystem)}</span>
          <span style={color ? { color } : undefined}>{node.label}</span>
          {agSyncState && <span style={{ color: "var(--fg-dim)", marginLeft: 4, fontSize: 11 }}>({agSyncState})</span>}
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
            <FolderNode key={folder.id} node={folder} server={server} dbName={node.label} sel={sel} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Folder node ---------- */
function FolderNode({ node, server, dbName, sel }: {
  node: TreeNode; server: string; dbName: string; sel: SelectionCtx;
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
  const displayChildren = lc ? node.children?.filter((c) => c.label.toLowerCase().includes(lc)) : node.children;

  return (
    <div className="tree-node">
      <div className="tree-node-label tree-label-flex" onClick={() => setExpanded((e) => !e)}>
        <span>
          {expanded ? "▾" : "▸"} <span className="tree-icon">{folderLabelIcon(node.label)}</span> {node.label}
          {displayChildren && <span style={{ color: "var(--fg-dim)", marginLeft: 4 }}>({displayChildren.length})</span>}
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
            <ObjectNode key={child.id} node={child} server={server} dbName={dbName} sel={sel} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Leaf / expandable object node — expand and select are separate ---------- */
function ObjectNode({ node, server, dbName, sel }: {
  node: TreeNode; server: string; dbName: string; sel: SelectionCtx;
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
  const canExpand = isTable || isFilegroup;
  const nodeId = `obj:${server}:${dbName}:${node.id}`;

  async function handleExpand(e: React.MouseEvent) {
    if (!canExpand) return;
    e.stopPropagation();
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
      } finally { setLoading(false); }
    }
    if (isFilegroup && !expanded && children === null) {
      setLoading(true);
      try {
        const filegroupId = node.meta?.dataSpaceId as number;
        setChildren(await bridge.getFilegroupFiles(server, dbName, filegroupId));
      } finally { setLoading(false); }
    }
    setExpanded((prev) => !prev);
  }

  function handleSelect() {
    if (!opensPanel) return;
    if (isTable || isView) {
      const schema = (node.meta?.schema as string) ?? node.label.split(".")[0];
      const objName = node.label.split(".").pop()!;
      sel.onSelect(nodeId, { server, view: isTable ? "table" : "view", database: dbName, schema, objectName: objName });
    }
    if (isProcedure || isFunction || isTrigger) {
      const parts = node.label.split(".");
      sel.onSelect(nodeId, { server, view: "sqlmodule", database: dbName, schema: parts[0], objectName: parts.pop()!, objectType: node.type });
    }
  }

  const icon = nodeIcon(node.type);

  if (canExpand) {
    return (
      <div className="tree-node">
        <div className={`tree-node-label${opensPanel ? " tree-clickable" : ""}${sel.selectedId === nodeId ? " tree-selected" : ""}`}>
          <span className="tree-toggle" onClick={handleExpand}>
            {loading ? <SpinnerIcon /> : (expanded ? "▾" : "▸")}
          </span>
          <span onClick={handleSelect} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span className="tree-icon">{icon}</span> {node.label}
          </span>
        </div>
        {expanded && children && (
          <div className="tree-children">
            {children.map((sub) => (
              <FolderNode key={sub.id} node={sub} server={server} dbName={dbName} sel={sel} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (opensPanel) {
    return (
      <div className="tree-node">
        <div
          className={`tree-node-label tree-clickable${sel.selectedId === nodeId ? " tree-selected" : ""}`}
          onClick={handleSelect}
        >
          <span className="tree-icon">{icon}</span> {node.label}
        </div>
      </div>
    );
  }

  return (
    <div className="tree-node">
      <div className="tree-node-label"><span className="tree-icon">{icon}</span> {node.label}</div>
    </div>
  );
}
