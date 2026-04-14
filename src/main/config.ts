/**
 *  Persist application settings (server list, timeouts) to a JSON file
 *  in the Electron userData directory.
 */
import fs from "fs";
import path from "path";
import { app } from "electron";

export interface AppConfig {
  servers: string[];
  executionTimeoutSec: number;
  connectionTimeoutSec: number;
}

const defaults: AppConfig = {
  servers: [],
  executionTimeoutSec: 90,
  connectionTimeoutSec: 10,
};

let cached: AppConfig | null = null;

function configPath(): string {
  return path.join(app.getPath("userData"), "AJCannon-config.json");
}

export function loadConfig(): AppConfig {
  if (cached) return cached;
  try {
    const raw = fs.readFileSync(configPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    cached = { ...defaults, ...parsed };
  } catch {
    cached = { ...defaults };
  }
  return cached;
}

export function saveConfig(cfg: AppConfig): void {
  cached = cfg;
  fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2), "utf8");
}

export function addServer(server: string): AppConfig {
  const cfg = loadConfig();
  if (!cfg.servers.includes(server)) {
    cfg.servers.push(server);
    saveConfig(cfg);
  }
  return cfg;
}

export function removeServer(server: string): AppConfig {
  const cfg = loadConfig();
  cfg.servers = cfg.servers.filter((s) => s !== server);
  saveConfig(cfg);
  return cfg;
}
