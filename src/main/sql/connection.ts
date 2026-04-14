import sql from "mssql/msnodesqlv8";
import { loadConfig } from "../config";
import { logQuery } from "../logger";

const pools = new Map<string, sql.ConnectionPool>();

export async function connectServer(server: string): Promise<void> {
  if (pools.has(server)) return;

  const cfg = loadConfig();

  const connectionString = [
    `Driver={ODBC Driver 18 for SQL Server}`,
    `Server=${server}`,
    `Trusted_Connection=Yes`,
    `TrustServerCertificate=Yes`,
  ].join(";");

  const pool = await new sql.ConnectionPool({
    connectionString,
    requestTimeout: cfg.executionTimeoutSec * 1000,
    connectionTimeout: cfg.connectionTimeoutSec * 1000,
  } as unknown as sql.config).connect();

  pools.set(server, pool);
}

export async function disconnectServer(server: string): Promise<void> {
  const pool = pools.get(server);
  if (pool) {
    await pool.close();
    pools.delete(server);
  }
}

export function getPool(server: string): sql.ConnectionPool {
  const pool = pools.get(server);
  if (!pool) throw new Error(`Not connected to ${server}`);
  return pool;
}

/** Execute a query against a specific database on a specific server */
export async function queryDb<T extends object>(
  server: string,
  database: string,
  queryText: string,
): Promise<sql.IResult<T>> {
  const start = Date.now();
  try {
    const p = getPool(server);
    const request = p.request();
    await request.batch(`USE ${bracketName(database)};`);
    const result = await request.query<T>(queryText);
    logQuery(server, database, queryText, Date.now() - start, result.recordset?.length ?? 0);
    return result;
  } catch (err) {
    logQuery(server, database, queryText, Date.now() - start, 0, (err as Error).message);
    throw err;
  }
}

/** Execute a query against master / server scope */
export async function queryServer<T extends object>(
  server: string,
  queryText: string,
): Promise<sql.IResult<T>> {
  const start = Date.now();
  try {
    const result = await getPool(server).request().query<T>(queryText);
    logQuery(server, null, queryText, Date.now() - start, result.recordset?.length ?? 0);
    return result;
  } catch (err) {
    logQuery(server, null, queryText, Date.now() - start, 0, (err as Error).message);
    throw err;
  }
}

/** Bracket-quote an identifier to prevent injection */
export function bracketName(name: string): string {
  return `[${name.replace(/\]/g, "]]")}]`;
}
