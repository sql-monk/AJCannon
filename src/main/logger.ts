/**
 *  Query execution logger — one log file per application session.
 *  Files are stored in <userData>/logs/AJCannon-YYYY-MM-DD_HH-mm-ss.log
 */
import fs from "fs";
import path from "path";
import { app } from "electron";

const sessionStart = new Date();
const ts = sessionStart.toISOString().replace(/[:.]/g, "-").slice(0, 19);
const logsDir = path.join(app.getPath("userData"), "logs");
const logFile = path.join(logsDir, `AJCannon-${ts}.log`);

// Ensure logs directory exists
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Write session header
fs.writeFileSync(logFile, `# AJCannon query log — session started ${sessionStart.toISOString()}\n\n`, "utf8");

export function logQuery(
  server: string,
  database: string | null,
  queryText: string,
  durationMs: number,
  rowsCount: number,
  error?: string,
): void {
  const now = new Date().toISOString();
  const dbPart = database ? ` [${database}]` : "";
  const status = error ? `ERROR: ${error}` : `OK ${rowsCount} rows`;
  const sqlOneLine = queryText.replace(/\s+/g, " ").trim();
  const truncated = sqlOneLine.length > 2000 ? sqlOneLine.slice(0, 2000) + "…" : sqlOneLine;
  const line = `[${now}] ${server}${dbPart} (${durationMs}ms) ${status}\n  ${truncated}\n\n`;
  fs.appendFileSync(logFile, line, "utf8");
}

export function getLogPath(): string {
  return logFile;
}

export function getLogContent(): string {
  try {
    return fs.readFileSync(logFile, "utf8");
  } catch {
    return "";
  }
}

export function getConfigPath(): string {
  return path.join(app.getPath("userData"), "AJCannon-config.json");
}
