import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { ObjectExplorer } from "./components/ObjectExplorer";
import { Dashboard } from "./components/Dashboard";
import { ActivityPanel } from "./components/ActivityPanel";
import { AgentPanel } from "./components/AgentPanel";
import { ServerPanel } from "./components/ServerPanel";
import { DatabasesPanel } from "./components/DatabasesPanel";
import { DatabasePanel } from "./components/DatabasePanel";
import { TablePanel } from "./components/TablePanel";
import { SqlModulePanel } from "./components/SqlModulePanel";
import { bridge } from "./bridge";
import type { AppConfig, SqlQueryFile } from "./bridge";
import type { TreeContext } from "../shared/types";
import hljs from "highlight.js/lib/core";
import sqlLang from "highlight.js/lib/languages/sql";
import "highlight.js/styles/vs2015.css";

interface Tab {
  id: string;
  title: string;
  ctx: TreeContext;
  rev: number;  // increment to force refresh
}


hljs.registerLanguage("sql", sqlLang);

/** Parse SQL file content into structured parts: tags line, column defs, and actual SQL */
function parseSqlContent(content: string): {
  columns: { name: string; type: string }[];
  sql: string;
} {
  const lines = content.split("\n");
  let idx = 0;

  // Skip tag line (starts with --)
  if (lines[idx]?.trimStart().startsWith("--")) idx++;

  // Parse column comment block /* ... */
  const columns: { name: string; type: string }[] = [];
  if (lines[idx]?.trim() === "/*") {
    idx++; // skip /*
    while (idx < lines.length && lines[idx]?.trim() !== "*/") {
      const line = lines[idx].trim().replace(/,$/, "");
      const parts = line.split(/\s+/);
      if (parts.length >= 2) {
        columns.push({ name: parts[0], type: parts.slice(1).join(" ") });
      }
      idx++;
    }
    if (lines[idx]?.trim() === "*/") idx++; // skip */
  }

  const sql = lines.slice(idx).join("\n").trim();
  return { columns, sql };
}

export function App() {
  const [servers, setServers] = useState<string[]>([]);
  const [ctx, setCtx] = useState<TreeContext | null>(null);
  const [showDashboard, setShowDashboard] = useState(true);
  const [connectError, setConnectError] = useState("");

  /* ---- Tab system ---- */
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  function tabKey(c: TreeContext): string {
    const parts = [c.server, c.view];
    if (c.database) parts.push(c.database);
    if (c.schema && c.objectName) parts.push(`${c.schema}.${c.objectName}`);
    return parts.join("::");
  }

  function tabTitle(c: TreeContext): string {
    const viewNames: Record<string, string> = {
      overview: "Server", activity: "Activity", agent: "Agent", databases: "Databases",
      security: "Security", server: "Server", configuration: "Configuration",
      alwayson: "Always On", extendedevents: "Extended Events", table: "Table", sqlmodule: "Module",
    };
    let title = viewNames[c.view] ?? c.view;
    if (c.objectName) title = `${c.schema ? c.schema + "." : ""}${c.objectName}`;
    if (c.database && c.view === "databases") title = c.database;
    const context = c.database ? `${c.server}/${c.database}` : c.server;
    return `${title} — ${context}`;
  }

  /* ---- Global error toast ---- */
  const [toast, setToast] = useState<{ msg: string; type: "error" | "success" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string, type: "error" | "success" = "error") {
    setToast({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 8000);
  }

  /* ---- Modal state ---- */
  const [modal, setModal] = useState<"config" | "log" | "queries" | null>(null);
  const [modalContent, setModalContent] = useState("");
  const [modalPath, setModalPath] = useState("");

  /* ---- Query browser state ---- */
  const [queryFiles, setQueryFiles] = useState<SqlQueryFile[]>([]);
  const [selectedQuery, setSelectedQuery] = useState<SqlQueryFile | null>(null);
  const [querySearch, setQuerySearch] = useState("");

  /** Filtered query list based on search */
  const filteredQueryFiles = queryFiles.filter((f) => {
    if (!querySearch) return true;
    return f.name.toLowerCase().includes(querySearch.toLowerCase());
  });

  async function openQueriesModal(prefix?: string) {
    try {
      const files = await bridge.getSqlQueries();
      setQueryFiles(files);
      if (prefix) {
        setQuerySearch(prefix);
        const matching = files.filter((f) => f.name.toLowerCase().includes(prefix.toLowerCase()));
        setSelectedQuery(matching.length > 0 ? matching[0] : files[0] ?? null);
      } else {
        setQuerySearch("");
        setSelectedQuery(files.length > 0 ? files[0] : null);
      }
      setModal("queries");
    } catch (err) {
      showToast(`Failed to load queries: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function copyQueryToClipboard() {
    if (!selectedQuery) return;
    navigator.clipboard.writeText(selectedQuery.content).then(
      () => showToast("Copied to clipboard", "success"),
      () => showToast("Failed to copy"),
    );
  }

  async function openConfigModal() {
    try {
      const [cfg, cfgPath] = await Promise.all([
        bridge.loadAppConfig(),
        bridge.getConfigPath(),
      ]);
      setModalContent(JSON.stringify(cfg, null, 2));
      setModalPath(cfgPath);
      setModal("config");
    } catch (err) {
      showToast(`Failed to load config: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function saveConfigFromModal() {
    try {
      const parsed = JSON.parse(modalContent);
      await bridge.saveAppConfig(parsed);
      showToast("Config saved", "success");
      setModal(null);
    } catch (err) {
      showToast(`Invalid config: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function openLogModal() {
    try {
      const [content, logPath] = await Promise.all([
        bridge.getLogContent(),
        bridge.getLogPath(),
      ]);
      setModalContent(content);
      setModalPath(logPath);
      setModal("log");
    } catch (err) {
      showToast(`Failed to load log: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function refreshLog() {
    try {
      const content = await bridge.getLogContent();
      setModalContent(content);
    } catch { /* ignore */ }
  }

  // Inline "add server" input
  const [addingServer, setAddingServer] = useState(false);
  const [newServer, setNewServer] = useState("localhost");
  const [connecting, setConnecting] = useState(false);

  // Splitter
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const dragging = useRef(false);

  /* ---- Load persisted servers on startup ---- */
  useEffect(() => {
    (async () => {
      try {
        const cfg: AppConfig = await bridge.loadAppConfig();
        if (cfg.servers.length > 0) {
          const connected: string[] = [];
          for (const s of cfg.servers) {
            try {
              await bridge.connect(s);
              connected.push(s);
            } catch (err: unknown) {
              showToast(`Failed to connect to ${s}: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
          setServers(connected);
        }
      } catch { /* first launch, no config */ }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAddServer() {
    const name = newServer.trim();
    if (!name) return;
    if (servers.includes(name)) { setAddingServer(false); return; }
    setConnectError("");
    setConnecting(true);
    try {
      await bridge.connect(name);
      setServers((prev) => [...prev, name]);
      setNewServer("localhost");
      setAddingServer(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setConnectError(msg);
      showToast(msg);
    } finally {
      setConnecting(false);
    }
  }

  function handleRemoveServer() {
    const server = ctx?.server;
    if (!server) return;
    bridge.disconnect(server).catch(() => {});
    setServers((prev) => prev.filter((s) => s !== server));
    setCtx(null);
    setShowDashboard(true);
  }

  function handleServerRemoved(server: string) {
    setServers((prev) => prev.filter((s) => s !== server));
    if (ctx?.server === server) {
      setCtx(null);
      setShowDashboard(true);
    }
  }

  function handleContextChange(newCtx: TreeContext) {
    setCtx(newCtx);
    setShowDashboard(false);

    const key = tabKey(newCtx);
    setTabs((prev) => {
      const existing = prev.find((t) => t.id === key);
      if (existing) {
        // Refresh existing tab
        return prev.map((t) => t.id === key ? { ...t, ctx: newCtx, rev: t.rev + 1 } : t);
      }
      return [...prev, { id: key, title: tabTitle(newCtx), ctx: newCtx, rev: 0 }];
    });
    setActiveTabId(key);
  }

  function closeTab(id: string) {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (activeTabId === id) {
        if (next.length > 0) {
          const idx = prev.findIndex((t) => t.id === id);
          const newActive = next[Math.min(idx, next.length - 1)];
          setActiveTabId(newActive.id);
          setCtx(newActive.ctx);
        } else {
          setActiveTabId(null);
          setCtx(null);
          setShowDashboard(true);
        }
      }
      return next;
    });
  }

  function handleRootSelected() {
    setCtx(null);
    setShowDashboard(true);
  }

  /* ---- Splitter mouse handlers ---- */
  const onMouseDown = useCallback(() => {
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const w = Math.max(180, Math.min(e.clientX, window.innerWidth - 200));
      setSidebarWidth(w);
    };
    const onMouseUp = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, []);

  /* ---- Render right panel based on context ---- */
  function renderContent() {
    if (showDashboard || !ctx) return <Dashboard servers={servers} />;

    switch (ctx.view) {
      case "activity":
        return <ActivityPanel server={ctx.server} onError={showToast} onShowSql={openQueriesModal} />;
      case "agent":
        return <AgentPanel server={ctx.server} onShowSql={openQueriesModal} />;
      case "server":
      case "configuration":
      case "overview":
        return <ServerPanel server={ctx.server} onShowSql={openQueriesModal} />;
      case "databases":
        if (ctx.database) {
          return <DatabasePanel server={ctx.server} database={ctx.database} />;
        }
        return <DatabasesPanel server={ctx.server} />;
      case "table":
        if (ctx.database && ctx.schema && ctx.objectName) {
          return <TablePanel server={ctx.server} database={ctx.database} schema={ctx.schema} objectName={ctx.objectName} onShowSql={openQueriesModal} />;
        }
        return <div className="tab-content"><div className="loading">Select a table.</div></div>;
      case "sqlmodule":
        if (ctx.database && ctx.schema && ctx.objectName) {
          return <SqlModulePanel server={ctx.server} database={ctx.database} schema={ctx.schema} objectName={ctx.objectName} objectType={ctx.objectType ?? "procedure"} onShowSql={openQueriesModal} />;
        }
        return <div className="tab-content"><div className="loading">Select a module.</div></div>;
      case "security":
        return (
          <div className="tab-content">
            <div className="loading">Security — coming soon.</div>
          </div>
        );
      case "db-querystats":
        return (
          <div className="tab-content">
            <div className="loading">{ctx.database ? `📊 Query stats — ${ctx.database}` : "Query stats — select a database."}</div>
          </div>
        );
      case "db-backups":
        return (
          <div className="tab-content">
            <div className="loading">{ctx.database ? `💾 Backups — ${ctx.database}` : "Backups — select a database."}</div>
          </div>
        );
      case "db-storage":
        return (
          <div className="tab-content">
            <div className="loading">{ctx.database ? `Storage — ${ctx.database}` : "Storage — select a database."}</div>
          </div>
        );
      case "db-security":
        return (
          <div className="tab-content">
            <div className="loading">{ctx.database ? `Security — ${ctx.database}` : "Security — select a database."}</div>
          </div>
        );
      case "db-tables":
      case "db-views":
      case "db-procedures":
      case "db-scalar-functions":
      case "db-tvf":
      case "db-user-types":
        return (
          <div className="tab-content">
            <div className="loading">{ctx.database ? `${ctx.view} — ${ctx.database}` : "Select a database."}</div>
          </div>
        );
      case "db-qs-regressed":
      case "db-qs-resource":
      case "db-qs-forced":
        return (
          <div className="tab-content">
            <div className="loading">{ctx.database ? `Query Store · ${ctx.view} — ${ctx.database}` : "Select a database."}</div>
          </div>
        );
      case "db-filegroups":
      case "db-partitioning":
        return (
          <div className="tab-content">
            <div className="loading">{ctx.database ? `Storage · ${ctx.view} — ${ctx.database}` : "Select a database."}</div>
          </div>
        );
      case "alwayson":
        return (
          <div className="tab-content">
            <div className="loading">Always On — coming soon.</div>
          </div>
        );
      case "extendedevents":
        return (
          <div className="tab-content">
            <div className="loading">Extended Events — coming soon.</div>
          </div>
        );
      default:
        return <div className="tab-content"><div className="loading">Select an item in the tree.</div></div>;
    }
  }

  return (
    <div className="app-layout">
      {/* ---- Toast ---- */}
      {toast && (
        <div className={`toast toast-${toast.type}`} onClick={() => setToast(null)}>
          {toast.msg}
        </div>
      )}

      {/* ---- Sidebar ---- */}
      <div className="sidebar" style={{ width: sidebarWidth, minWidth: 180 }}>
        {/* Button row */}
        <div className="sidebar-buttons">
          <button onClick={() => setAddingServer((v) => !v)} title="Add server">add...</button>
          <button onClick={openConfigModal} title="View / edit config">cfg...</button>
          <button onClick={openLogModal} title="View query log">log...</button>
          <button onClick={() => openQueriesModal()} title="All SQL queries">sql...</button>
        </div>

        {/* Inline add-server input */}
        {addingServer && (
          <div className="sidebar-add-row">
            <input
              value={newServer}
              onChange={(e) => setNewServer(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddServer(); if (e.key === "Escape") setAddingServer(false); }}
              placeholder="server\instance"
              autoFocus
              disabled={connecting}
              style={{ flex: 1 }}
            />
            <button onClick={handleAddServer} disabled={connecting} style={{ padding: "4px 8px" }}>
              {connecting ? "..." : "OK"}
            </button>
          </div>
        )}
        {connectError && <div className="error-msg" style={{ padding: "0 8px", fontSize: 11 }}>{connectError}</div>}

        {/* Tree */}
        <ObjectExplorer
          servers={servers}
          onContextChange={handleContextChange}
          onServerRemoved={handleServerRemoved}
          onRootSelected={handleRootSelected}
        />
      </div>

      {/* ---- Splitter handle ---- */}
      <div className="splitter" onMouseDown={onMouseDown} />

      {/* ---- Main content ---- */}
      <div className="main-content">
        {/* Tab bar */}
        {tabs.length > 0 && (
          <div className="content-tab-bar">
            <div
              className={`content-tab${showDashboard ? " active" : ""}`}
              onClick={handleRootSelected}
            >
              Dashboard
            </div>
            {tabs.map((tab) => (
              <div
                key={tab.id}
                className={`content-tab${activeTabId === tab.id && !showDashboard ? " active" : ""}`}
                onClick={() => { setActiveTabId(tab.id); setCtx(tab.ctx); setShowDashboard(false); }}
              >
                <span className="content-tab-title">{tab.title}</span>
                <button className="content-tab-close" onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}>✕</button>
              </div>
            ))}
          </div>
        )}
        <div className="content-body" key={activeTabId && !showDashboard ? `${activeTabId}::${tabs.find(t => t.id === activeTabId)?.rev ?? 0}` : "__dashboard__"}>
          {renderContent()}
        </div>
      </div>

      {/* ---- Modal ---- */}
      {modal && modal !== "queries" && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span>{modal === "config" ? "Configuration" : "Query Log"}</span>
              <button onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="modal-path">{modalPath}</div>
              {modal === "config" ? (
                <textarea
                  value={modalContent}
                  onChange={(e) => setModalContent(e.target.value)}
                  spellCheck={false}
                />
              ) : (
                <pre>{modalContent || "(no queries logged yet)"}</pre>
              )}
            </div>
            <div className="modal-footer">
              {modal === "log" && (
                <button onClick={refreshLog}>Refresh</button>
              )}
              {modal === "config" && (
                <button onClick={saveConfigFromModal}>Save</button>
              )}
              <button onClick={() => setModal(null)} style={{ background: "var(--bg-input)" }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Query Browser Modal ---- */}
      {modal === "queries" && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal query-browser-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span>All SQL Queries ({filteredQueryFiles.length}/{queryFiles.length})</span>
              <button onClick={() => setModal(null)}>✕</button>
            </div>
            {/* Search bar */}
            <div className="query-filter-bar">
              <input
                value={querySearch}
                onChange={(e) => setQuerySearch(e.target.value)}
                placeholder="Filter by name..."
                className="query-search-input"
              />
              {querySearch && (
                <button className="btn-sm" onClick={() => setQuerySearch("")}>✕</button>
              )}
            </div>
            <div className="query-browser">
              <div className="query-list">
                {filteredQueryFiles.map((q) => (
                  <div
                    key={q.fileName}
                    className={`query-list-item${selectedQuery?.fileName === q.fileName ? " active" : ""}`}
                    onClick={() => setSelectedQuery(q)}
                  >
                    {q.name}
                  </div>
                ))}
              </div>
              <div className="query-content">
                {selectedQuery && <QueryContentView query={selectedQuery} onCopy={copyQueryToClipboard} />}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Query Content View (right pane of query browser) ---- */
function QueryContentView({ query, onCopy }: { query: SqlQueryFile; onCopy: () => void }) {
  const [colsOpen, setColsOpen] = useState(true);

  const parsed = useMemo(() => parseSqlContent(query.content), [query.content]);
  const highlightedHtml = useMemo(() => {
    if (!parsed.sql) return "";
    return hljs.highlight(parsed.sql, { language: "sql" }).value;
  }, [parsed.sql]);

  return (
    <>
      {/* Toolbar */}
      <div className="query-content-toolbar">
        <span className="query-content-path" title={query.filePath}>{query.fileName}</span>
        <div className="query-content-actions">
          <button onClick={onCopy} title="Copy to clipboard">Copy</button>
          <button onClick={() => bridge.openInEditor(query.filePath)} title="Open in default editor">Edit</button>
          <button onClick={() => bridge.openInExplorer(query.filePath)} title="Show in Explorer">Explorer</button>
        </div>
      </div>

      {/* Tags */}
      {query.tags.length > 0 && (
        <div className="query-tags-row">
          {query.tags.map((t) => (
            <span key={t} className="chip chip-active">{t}</span>
          ))}
        </div>
      )}

      {/* Columns (collapsible) */}
      {parsed.columns.length > 0 && (
        <div className="query-columns-section">
          <div className="query-columns-header" onClick={() => setColsOpen((v) => !v)}>
            <span className="cpanel-toggle">{colsOpen ? "▾" : "▸"}</span>
            <span>Columns ({parsed.columns.length})</span>
          </div>
          {colsOpen && (
            <div className="query-columns-body">
              {parsed.columns.map((c) => (
                <div key={c.name} className="query-column-row">
                  <span className="query-column-name">{c.name}</span>
                  <span className="query-column-type">{c.type}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Highlighted SQL */}
      <pre className="query-content-sql hljs"><code dangerouslySetInnerHTML={{ __html: highlightedHtml }} /></pre>
    </>
  );
}
