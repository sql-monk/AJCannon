import type { ReactNode } from "react";

function getServerColor(server: string): string {
  try { return localStorage.getItem(`AJCannon:server-color:${server}`) ?? "#0e639c"; } catch { return "#0e639c"; }
}

interface Props {
  icon: ReactNode;
  title: string;
  server: string;
  /** Right-side color of the gradient separator */
  pageColor?: string;
  /** Breadcrumb parts after server (e.g. [database, schema.objectName]) */
  breadcrumb?: string[];
  onRefresh?: () => void;
  loading?: boolean;
}

export function PageHeader({ icon, title, server, pageColor = "#333", breadcrumb, onRefresh, loading }: Props) {
  const serverColor = getServerColor(server);
  const crumb = [server, ...(breadcrumb ?? [])].filter(Boolean).join(" — ");
  return (
    <div className="page-hdr">
      <div className="page-hdr-row">
        <span className="page-hdr-icon">{icon}</span>
        <span className="page-hdr-sep">|</span>
        <h3 className="page-hdr-title">{title}</h3>
        {onRefresh && (
          <button
            className="page-hdr-refresh"
            onClick={onRefresh}
            disabled={loading}
            title="Refresh"
          >
            {loading ? "..." : "⟳ Refresh"}
          </button>
        )}
      </div>
      <div
        className="page-hdr-gradient"
        style={{ background: `linear-gradient(to right, ${serverColor}, ${pageColor})` }}
      />
      <div className="page-hdr-crumb">{crumb}</div>
    </div>
  );
}
