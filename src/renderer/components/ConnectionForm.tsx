import { useState } from "react";
import { bridge } from "../bridge";

interface Props {
  onServerAdded: (server: string) => void;
}

export function ConnectionForm({ onServerAdded }: Props) {
  const [server, setServer] = useState("localhost");
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);

  async function handleAdd() {
    if (!server.trim()) return;
    setError("");
    setConnecting(true);
    try {
      await bridge.connect(server.trim());
      onServerAdded(server.trim());
      setServer("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setConnecting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  }

  return (
    <div className="conn-form">
      <div style={{ display: "flex", gap: 4 }}>
        <input
          value={server}
          onChange={(e) => setServer(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="server\\instance"
          style={{ flex: 1 }}
          disabled={connecting}
        />
        <button onClick={handleAdd} disabled={connecting}>
          {connecting ? "..." : "Add"}
        </button>
      </div>
      {error && <div className="error-msg">{error}</div>}
    </div>
  );
}
