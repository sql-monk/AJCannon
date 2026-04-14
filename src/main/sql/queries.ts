/**
 *  All T-SQL queries for the application.
 *  Targeting SQL Server 2022.
 *  Following the NOLOCK-on-DMV convention from skill-sqls-tsql.
 *
 *  Non-trivial SQL lives in ./queries/*.sql — loaded at startup via loadSql().
 *  Trivial one-liners (KILL, sp_stop_job, etc.) remain inline.
 */
import fs from "fs";
import path from "path";
import { queryServer, queryDb, bracketName } from "./connection";
import type {
  TreeNode,
  VolumeSpaceInfo,
  DatabaseSpaceOnVolume,
  FileSpaceInfo,
  ObjectSpaceInfo,
  CpuSnapshot,
  CpuByDatabase,
  IoByDatabase,
  WaitStatInfo,
  BlockingProcess,
  ServerSummary,
  ShrinkRequest,
  ShrinkResult,
  SessionInfo,
  SessionDetail,
  ExpensiveQuery,
  AgentJob,
  AgentJobStep,
  AgentJobSchedule,
  RunningJob,
  ServerInfo,
  BufferPoolEntry,
  ServerService,
  ServerConfigOption,
  CmdResult,
  RamOverview,
  DatabaseSizeInfo,
  DatabaseOverviewInfo,
  AvailabilityGroupInfo,
  DatabaseDetailInfo,
  ExtendedProperty,
  DdlHistoryEvent,
  TableDetailInfo,
  TableColumnDetail,
  TableTriggerInfo,
  TablePermissionInfo,
  SqlModuleInfo,
  SqlModuleParameter,
  SqlModuleDependency,
} from "../../shared/types";

/* ------------------------------------------------------------------ */
/*  SQL file loader — reads .sql once and caches in memory             */
/* ------------------------------------------------------------------ */

const sqlCache = new Map<string, string>();

function loadSql(name: string): string {
  let sql = sqlCache.get(name);
  if (sql !== undefined) return sql;

  const filePath = path.join(__dirname, "queries", `${name}.sql`);
  sql = fs.readFileSync(filePath, "utf8");
  sqlCache.set(name, sql);
  return sql;
}

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

/* ================================================================== */
/*  List all SQL query files (for the query browser)                   */
/* ================================================================== */

export interface SqlQueryFile {
  name: string;
  fileName: string;
  filePath: string;
  content: string;
  tags: string[];
}

export function getAllSqlQueries(): SqlQueryFile[] {
  const dir = path.join(__dirname, "queries");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  return files.map((fileName) => {
    const filePath = path.join(dir, fileName);
    const content = fs.readFileSync(filePath, "utf8");
    const tags = parseSqlTags(content);
    return {
      name: fileName.replace(/\.sql$/, ""),
      fileName,
      filePath,
      content,
      tags,
    };
  });
}

function parseSqlTags(content: string): string[] {
  const firstLine = content.split("\n")[0]?.trim() ?? "";
  if (!firstLine.startsWith("--")) return [];
  return firstLine
    .slice(2)
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

/* ================================================================== */
/*  Dashboard (root node) — lightweight summary per server            */
/* ================================================================== */

export async function getServerSummary(server: string): Promise<ServerSummary> {
  const result = await queryServer<{
    sqlCpu: number;
    runningCount: number;
    runnableCount: number;
    suspendedCount: number;
    blockingCount: number;
    maxBlockedWaitSec: number;
  }>(server, loadSql("server-summary"));

  const row = result.recordset[0];
  return {
    server,
    sqlCpu: row?.sqlCpu ?? 0,
    runningCount: row?.runningCount ?? 0,
    runnableCount: row?.runnableCount ?? 0,
    suspendedCount: row?.suspendedCount ?? 0,
    blockingCount: row?.blockingCount ?? 0,
    maxBlockedWaitSec: row?.maxBlockedWaitSec ?? 0,
  };
}

/* ================================================================== */
/*  Object Explorer                                                   */
/* ================================================================== */

export async function getDatabases(server: string): Promise<TreeNode[]> {
  const result = await queryServer<{
    name: string;
    database_id: number;
    state_desc: string;
    ag_name: string | null;
    ag_sync_state: string | null;
  }>(server, loadSql("databases"));

  return result.recordset.map((r) => ({
    id: `${server}:db:${r.database_id}`,
    label: r.name,
    type: "database" as const,
    meta: {
      databaseId: r.database_id,
      state: r.state_desc,
      agName: r.ag_name,
      agSyncState: r.ag_sync_state,
    },
  }));
}

export async function getDatabaseChildren(server: string, dbName: string): Promise<TreeNode[]> {
  const id = (suffix: string) => `${server}:${dbName}:${suffix}`;

  // Objects — all cheap sys.* queries, run in parallel
  const [tables, views, procs, tvfs, scalarFns, synonyms, dbTriggers, userTypes] =
    await Promise.all([
      getTablesOrViews(server, dbName, "table"),
      getTablesOrViews(server, dbName, "view"),
      getProcedures(server, dbName),
      getTableValuedFunctions(server, dbName),
      getScalarFunctions(server, dbName),
      getSynonyms(server, dbName),
      getDbTriggers(server, dbName),
      getUserTypes(server, dbName),
    ]);

  const objectFolders: TreeNode[] = [
    { id: id("tables"),  label: "Tables",                  type: "folder", children: tables },
    { id: id("views"),   label: "Views",                   type: "folder", children: views },
    { id: id("procs"),   label: "Stored Procedures",       type: "folder", children: procs },
    { id: id("sfuncs"),  label: "Scalar Functions",         type: "folder", children: scalarFns },
    { id: id("tvfs"),    label: "Table Valued Functions",   type: "folder", children: tvfs },
    { id: id("utypes"),  label: "User Defined Types",       type: "folder", children: userTypes },
  ];

  // Query Store — probe if enabled, omit if disabled
  const qsFolder = await buildQueryStoreFolder(server, dbName, id);

  // Storage — filegroups, partition schemas, partition functions
  const [filegroups, partSchemas, partFunctions] = await Promise.all([
    getFilegroups(server, dbName),
    getPartitionSchemas(server, dbName),
    getPartitionFunctions(server, dbName),
  ]);

  const storageFolder: TreeNode = {
    id: id("storage"), label: "Storage", type: "folder",
    children: [
      { id: id("fgs"),     label: "Filegroups",          type: "folder", children: filegroups },
      { id: id("partitioning"), label: "Partitioning",  type: "folder", children: [
        ...partSchemas,
        ...partFunctions,
      ]},
    ],
  };

  // Security — subfolders (future: users, roles, schemas)
  const securityFolder: TreeNode = {
    id: id("security"), label: "Security", type: "folder",
    children: [
      { id: id("sec-users"),   label: "Users",   type: "folder" },
      { id: id("sec-roles"),   label: "Roles",   type: "folder" },
      { id: id("sec-schemas"), label: "Schemas", type: "folder" },
    ],
  };

  const result: TreeNode[] = [...objectFolders];
  if (qsFolder) result.push(qsFolder);
  result.push(storageFolder, securityFolder);
  return result;
}

/* ---------- Objects helpers ---------- */

async function getTablesOrViews(
  server: string,
  dbName: string,
  kind: "table" | "view",
): Promise<TreeNode[]> {
  const sql = kind === "table" ? loadSql("tables") : loadSql("views");
  const result = await queryDb<{ schemaName: string; name: string; object_id: number }>(
    server, dbName, sql,
  );

  return result.recordset.map((r) => ({
    id: `${server}:${dbName}:${kind}:${r.schemaName}.${r.name}`,
    label: `${r.schemaName}.${r.name}`,
    type: kind,
    meta: { schema: r.schemaName, objectId: r.object_id },
  }));
}

async function getProcedures(server: string, dbName: string): Promise<TreeNode[]> {
  const result = await queryDb<{ schemaName: string; name: string }>(
    server, dbName, loadSql("procedures"),
  );

  return result.recordset.map((r) => ({
    id: `${server}:${dbName}:proc:${r.schemaName}.${r.name}`,
    label: `${r.schemaName}.${r.name}`,
    type: "procedure" as const,
  }));
}

async function getScalarFunctions(server: string, dbName: string): Promise<TreeNode[]> {
  const result = await queryDb<{ schemaName: string; name: string }>(
    server, dbName, loadSql("scalar-functions"),
  );

  return result.recordset.map((r) => ({
    id: `${server}:${dbName}:sfn:${r.schemaName}.${r.name}`,
    label: `${r.schemaName}.${r.name}`,
    type: "function" as const,
  }));
}

async function getTableValuedFunctions(server: string, dbName: string): Promise<TreeNode[]> {
  const result = await queryDb<{ schemaName: string; name: string; type_desc: string }>(
    server, dbName, loadSql("table-valued-functions"),
  );

  return result.recordset.map((r) => ({
    id: `${server}:${dbName}:tvf:${r.schemaName}.${r.name}`,
    label: `${r.schemaName}.${r.name}`,
    type: "function" as const,
    meta: { typeDesc: r.type_desc },
  }));
}

async function getSynonyms(server: string, dbName: string): Promise<TreeNode[]> {
  const result = await queryDb<{ schemaName: string; name: string; base_object_name: string }>(
    server, dbName, loadSql("synonyms"),
  );

  return result.recordset.map((r) => ({
    id: `${server}:${dbName}:syn:${r.schemaName}.${r.name}`,
    label: `${r.schemaName}.${r.name}`,
    type: "synonym" as const,
    meta: { baseObject: r.base_object_name },
  }));
}

async function getDbTriggers(server: string, dbName: string): Promise<TreeNode[]> {
  const result = await queryDb<{ name: string; is_disabled: boolean }>(
    server, dbName, loadSql("db-triggers"),
  );

  return result.recordset.map((r) => ({
    id: `${server}:${dbName}:dbtrig:${r.name}`,
    label: r.name,
    type: "trigger" as const,
    meta: { isDisabled: r.is_disabled },
  }));
}

async function getUserTypes(server: string, dbName: string): Promise<TreeNode[]> {
  const result = await queryDb<{
    schemaName: string; name: string; base_type: string; max_length: number; is_nullable: boolean;
  }>(server, dbName, loadSql("user-types"));

  return result.recordset.map((r) => ({
    id: `${server}:${dbName}:utype:${r.schemaName}.${r.name}`,
    label: `${r.schemaName}.${r.name}`,
    type: "user-type" as const,
    meta: { baseType: r.base_type, maxLength: r.max_length, isNullable: r.is_nullable },
  }));
}

/* ---------- Query Store helpers ---------- */

async function buildQueryStoreFolder(
  server: string,
  dbName: string,
  id: (s: string) => string,
): Promise<TreeNode | null> {
  try {
    const opts = await queryDb<{ actual_state_desc: string }>(
      server, dbName, loadSql("query-store-options"),
    );
    const state = opts.recordset[0]?.actual_state_desc;
    if (!state || state === "OFF") return null;
  } catch {
    return null;
  }

  const [regressed, resource, forced] = await Promise.all([
    queryDb<{ query_id: number; query_sql_text: string }>(server, dbName, loadSql("query-store-regressed")),
    queryDb<{ query_id: number; query_sql_text: string }>(server, dbName, loadSql("query-store-resource")),
    queryDb<{ query_id: number; query_sql_text: string }>(server, dbName, loadSql("query-store-forced")),
  ]);

  const mapQs = (prefix: string, rows: { query_id: number; query_sql_text: string }[]): TreeNode[] =>
    rows.map((r) => ({
      id: `${id(prefix)}:${r.query_id}`,
      label: `Query ${r.query_id}`,
      type: "folder" as const,
      meta: { queryText: r.query_sql_text },
    }));

  return {
    id: id("qstore"), label: "Query Store", type: "folder",
    children: [
      { id: id("qs-regressed"), label: "Regressed Queries",   type: "folder", children: mapQs("qsr", regressed.recordset) },
      { id: id("qs-resource"),  label: "Resource Consuming",   type: "folder", children: mapQs("qsrc", resource.recordset) },
      { id: id("qs-forced"),    label: "Forced Plans",         type: "folder", children: mapQs("qsf", forced.recordset) },
    ],
  };
}

/* ---------- Backups helpers ---------- */

async function buildBackupsFolder(
  server: string,
  dbName: string,
  id: (s: string) => string,
): Promise<TreeNode> {
  let backupRows: { backup_type: string; backup_type_desc: string; backup_start_date: string; backup_size_mb: number }[] = [];
  try {
    const sql = loadSql("backups").replace("{{dbName}}", escapeSqlString(dbName));
    const result = await queryDb<{
      backup_type: string; backup_type_desc: string;
      backup_start_date: string; backup_size_mb: number;
    }>(server, dbName, sql);
    backupRows = result.recordset;
  } catch {
    // msdb access may be restricted
  }

  const groups: Record<string, TreeNode[]> = { Full: [], Differential: [], Log: [] };
  for (const r of backupRows) {
    const desc = r.backup_type_desc || "Full";
    if (!groups[desc]) groups[desc] = [];
    const dateStr = new Date(r.backup_start_date).toLocaleString();
    const sizeMb = typeof r.backup_size_mb === "number" ? r.backup_size_mb.toFixed(1) : "?";
    groups[desc].push({
      id: `${id("bak")}:${desc}:${r.backup_start_date}`,
      label: `${dateStr}  (${sizeMb} MB)`,
      type: "backup" as const,
    });
  }

  return {
    id: id("backups"), label: "Backups", type: "folder",
    children: [
      { id: id("bak-full"), label: "Full",         type: "folder", children: groups["Full"] },
      { id: id("bak-diff"), label: "Differential",  type: "folder", children: groups["Differential"] },
      { id: id("bak-log"),  label: "Log",           type: "folder", children: groups["Log"] },
    ],
  };
}

/* ---------- Storage helpers ---------- */

async function getFilegroups(server: string, dbName: string): Promise<TreeNode[]> {
  const result = await queryDb<{
    data_space_id: number; name: string; type: string; is_default: boolean; is_read_only: boolean;
  }>(server, dbName, loadSql("filegroups"));

  return result.recordset.map((r) => ({
    id: `${server}:${dbName}:fg:${r.data_space_id}`,
    label: r.name,
    type: "filegroup" as const,
    meta: { dataSpaceId: r.data_space_id, fgType: r.type, isDefault: r.is_default, isReadOnly: r.is_read_only },
  }));
}

export async function getFilegroupFiles(
  server: string,
  dbName: string,
  filegroupId: number,
): Promise<TreeNode[]> {
  const sql = loadSql("filegroup-files")
    .replace("{{filegroupId}}", String(Number(filegroupId)));

  const result = await queryDb<{
    file_id: number; name: string; type_desc: string;
    physical_name: string; size_mb: number; growth_desc: string;
  }>(server, dbName, sql);

  return result.recordset.map((r) => ({
    id: `${server}:${dbName}:dbfile:${r.file_id}`,
    label: `${r.name}  (${r.size_mb.toFixed(1)} MB)`,
    type: "folder" as const,
    meta: { fileId: r.file_id, typeDesc: r.type_desc, physicalName: r.physical_name, growthDesc: r.growth_desc },
  }));
}

async function getPartitionSchemas(server: string, dbName: string): Promise<TreeNode[]> {
  const result = await queryDb<{ name: string; data_space_id: number; function_name: string }>(
    server, dbName, loadSql("partition-schemas"),
  );

  return result.recordset.map((r) => ({
    id: `${server}:${dbName}:ps:${r.data_space_id}`,
    label: r.name,
    type: "partition-schema" as const,
    meta: { functionName: r.function_name },
  }));
}

async function getPartitionFunctions(server: string, dbName: string): Promise<TreeNode[]> {
  const result = await queryDb<{
    name: string; function_id: number; type_desc: string; fanout: number; boundary_value_on_right: boolean;
  }>(server, dbName, loadSql("partition-functions"));

  return result.recordset.map((r) => ({
    id: `${server}:${dbName}:pf:${r.function_id}`,
    label: r.name,
    type: "partition-function" as const,
    meta: { typeDesc: r.type_desc, fanout: r.fanout, boundaryRight: r.boundary_value_on_right },
  }));
}

export async function getTableIndexes(
  server: string,
  dbName: string,
  schemaName: string,
  tableName: string,
): Promise<TreeNode[]> {
  const sql = loadSql("table-indexes")
    .replace("{{schemaName}}", escapeSqlString(schemaName))
    .replace("{{tableName}}", escapeSqlString(tableName));

  const result = await queryDb<{
    name: string | null;
    index_id: number;
    type_desc: string;
  }>(server, dbName, sql);

  return result.recordset
    .filter((r) => r.name !== null)
    .map((r) => ({
      id: `${server}:${dbName}:idx:${schemaName}.${tableName}.${r.name}`,
      label: `${r.name} (${r.type_desc})`,
      type: "index" as const,
      meta: { indexId: r.index_id },
    }));
}

export async function getTableColumns(
  server: string,
  dbName: string,
  schemaName: string,
  tableName: string,
): Promise<TreeNode[]> {
  const sql = loadSql("table-columns")
    .replace("{{schemaName}}", escapeSqlString(schemaName))
    .replace("{{tableName}}", escapeSqlString(tableName));

  const result = await queryDb<{
    name: string;
    type_name: string;
    max_length: number;
    is_nullable: boolean;
  }>(server, dbName, sql);

  return result.recordset.map((r) => ({
    id: `${server}:${dbName}:col:${schemaName}.${tableName}.${r.name}`,
    label: `${r.name}  (${r.type_name}${r.is_nullable ? ", null" : ""})`,
    type: "column" as const,
  }));
}

/* ================================================================== */
/*  Overview — CPU / Waits / Blocking                                 */
/* ================================================================== */

export async function getCpuOverview(server: string): Promise<CpuSnapshot[]> {
  const result = await queryServer<{
    eventTime: Date;
    sqlCpu: number;
    systemIdle: number;
  }>(server, loadSql("cpu-overview"));

  return result.recordset.map((r) => ({
    eventTime: new Date(r.eventTime).toLocaleTimeString(),
    sqlCpu: r.sqlCpu,
    systemIdle: r.systemIdle,
    otherCpu: 100 - r.sqlCpu - r.systemIdle,
  }));
}

export async function getCpuByDb(server: string): Promise<CpuByDatabase[]> {
  const result = await queryServer<CpuByDatabase>(server, loadSql("cpu-by-db"));
  return result.recordset;
}

export async function getIoByDb(server: string): Promise<IoByDatabase[]> {
  const result = await queryServer<IoByDatabase>(server, loadSql("io-by-db"));
  return result.recordset;
}

const BENIGN_WAITS = [
  'CLR_SEMAPHORE','LAZYWRITER_SLEEP','RESOURCE_QUEUE','SLEEP_TASK',
  'SLEEP_SYSTEMTASK','SQLTRACE_BUFFER_FLUSH','WAITFOR','LOGMGR_QUEUE',
  'CHECKPOINT_QUEUE','REQUEST_FOR_DEADLOCK_SEARCH','XE_TIMER_EVENT',
  'BROKER_TO_FLUSH','BROKER_TASK_STOP','CLR_MANUAL_EVENT','CLR_AUTO_EVENT',
  'DISPATCHER_QUEUE_SEMAPHORE','FT_IFTS_SCHEDULER_IDLE_WAIT',
  'XE_DISPATCHER_WAIT','XE_DISPATCHER_JOIN',
  'SQLTRACE_INCREMENTAL_FLUSH_SLEEP','ONDEMAND_TASK_QUEUE',
  'BROKER_EVENTHANDLER','SLEEP_BPOOL_FLUSH','SLEEP_DBSTARTUP',
  'DIRTY_PAGE_POLL','HADR_FILESTREAM_IOMGR_IOCOMPLETION',
  'SP_SERVER_DIAGNOSTICS_SLEEP','QDS_PERSIST_TASK_MAIN_LOOP_SLEEP',
  'QDS_ASYNC_QUEUE','QDS_CLEANUP_STALE_QUERIES_TASK_MAIN_LOOP_SLEEP',
  'WAIT_XTP_CKPT_CLOSE','XE_LIVE_TARGET_TVF',
];

export async function getWaitStats(server: string): Promise<WaitStatInfo[]> {
  const excludeList = BENIGN_WAITS.map((w) => `'${w}'`).join(",");
  const sql = loadSql("wait-stats").replace("{{excludeList}}", excludeList);

  const result = await queryServer<WaitStatInfo>(server, sql);
  return result.recordset;
}

export async function getBlocking(server: string): Promise<BlockingProcess[]> {
  const result = await queryServer<BlockingProcess>(server, loadSql("blocking-tree"));
  return result.recordset;
}

/* ================================================================== */
/*  Disk Space — Volume -> DB -> Files -> Objects drill-down          */
/* ================================================================== */

export async function getVolumes(server: string): Promise<VolumeSpaceInfo[]> {
  const result = await queryServer<VolumeSpaceInfo>(server, loadSql("volumes"));
  return result.recordset;
}

export async function getDbSpaceOnVolume(
  server: string,
  volumeMountPoint: string,
): Promise<DatabaseSpaceOnVolume[]> {
  const sql = loadSql("db-space-on-volume")
    .replace("{{volumeMountPoint}}", escapeSqlString(volumeMountPoint));

  const result = await queryServer<DatabaseSpaceOnVolume>(server, sql);
  return result.recordset;
}

export async function getFileSpace(
  server: string,
  dbName: string,
): Promise<FileSpaceInfo[]> {
  const result = await queryDb<FileSpaceInfo>(server, dbName, loadSql("file-space"));
  return result.recordset;
}

export async function getObjectSpace(
  server: string,
  dbName: string,
  fileId: number,
): Promise<ObjectSpaceInfo[]> {
  const sql = loadSql("object-space")
    .replace("{{fileId}}", String(Number(fileId)));

  const result = await queryDb<ObjectSpaceInfo>(server, dbName, sql);
  return result.recordset;
}

/* ================================================================== */
/*  Shrink                                                            */
/* ================================================================== */

export async function shrink(req: ShrinkRequest): Promise<ShrinkResult> {
  try {
    const db = bracketName(req.databaseName);

    if (req.fileId != null) {
      const target = req.targetSizeMB != null ? `, ${Number(req.targetSizeMB)}` : "";
      await queryDb(
        req.server,
        req.databaseName,
        `DBCC SHRINKFILE (${Number(req.fileId)}${target});`,
      );
      return { success: true, message: `SHRINKFILE completed for file ${req.fileId} in ${db}` };
    } else {
      const pct = req.targetSizeMB != null ? `, ${Number(req.targetSizeMB)}` : "";
      await queryDb(
        req.server,
        req.databaseName,
        `DBCC SHRINKDATABASE (${db}${pct});`,
      );
      return { success: true, message: `SHRINKDATABASE completed for ${db}` };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, message };
  }
}

/* ================================================================== */
/*  Current Activity — Sessions / Detail / Kill                       */
/* ================================================================== */

export async function getSessions(server: string): Promise<SessionInfo[]> {
  const result = await queryServer<SessionInfo>(server, loadSql("sessions"));
  return result.recordset;
}

export async function getSessionDetail(
  server: string,
  sessionId: number,
): Promise<SessionDetail | null> {
  const sid = Number(sessionId);
  if (!Number.isInteger(sid) || sid <= 0) return null;

  const sql = loadSql("session-detail").replace("{{sessionId}}", String(sid));

  const result = await queryServer<{ queryText: string; queryPlan: string | null }>(server, sql);

  const row = result.recordset[0];
  if (!row) return null;

  return { queryText: row.queryText, queryPlan: row.queryPlan };
}

export async function killSession(
  server: string,
  sessionId: number,
): Promise<CmdResult> {
  const sid = Number(sessionId);
  if (!Number.isInteger(sid) || sid <= 0) {
    return { success: false, message: "Invalid session ID" };
  }
  try {
    await queryServer(server, `KILL ${sid};`);
    return { success: true, message: `Session ${sid} killed.` };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, message };
  }
}

/* ================================================================== */
/*  Expensive Queries                                                 */
/* ================================================================== */

export async function getExpensiveQueries(server: string): Promise<ExpensiveQuery[]> {
  const result = await queryServer<ExpensiveQuery>(server, loadSql("expensive-queries"));
  return result.recordset;
}

/* ================================================================== */
/*  SQL Agent                                                         */
/* ================================================================== */

export async function getAgentJobs(server: string): Promise<AgentJob[]> {
  const result = await queryServer<AgentJob>(server, loadSql("agent-jobs"));
  return result.recordset;
}

export async function getJobSteps(
  server: string,
  jobId: string,
): Promise<AgentJobStep[]> {
  const sql = loadSql("job-steps").replace("{{jobId}}", escapeSqlString(jobId));
  const result = await queryServer<AgentJobStep>(server, sql);
  return result.recordset;
}

export async function getRunningJobs(server: string): Promise<RunningJob[]> {
  const result = await queryServer<RunningJob>(server, loadSql("running-jobs"));
  return result.recordset;
}

export async function getJobSchedules(
  server: string,
  jobId: string,
): Promise<AgentJobSchedule[]> {
  const sql = loadSql("job-schedules").replace("{{jobId}}", escapeSqlString(jobId));
  const result = await queryServer<AgentJobSchedule>(server, sql);
  return result.recordset;
}

export async function stopAgentJob(
  server: string,
  jobId: string,
): Promise<CmdResult> {
  try {
    await queryServer(server,
      `EXEC msdb.dbo.sp_stop_job @job_id = '${escapeSqlString(jobId)}';`,
    );
    return { success: true, message: "Job stopped." };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, message };
  }
}

export async function toggleAgentJob(
  server: string,
  jobId: string,
  enable: boolean,
): Promise<CmdResult> {
  try {
    await queryServer(server,
      `EXEC msdb.dbo.sp_update_job @job_id = '${escapeSqlString(jobId)}', @enabled = ${enable ? 1 : 0};`,
    );
    return { success: true, message: enable ? "Job enabled." : "Job disabled." };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, message };
  }
}

export async function startJobAtStep(
  server: string,
  jobId: string,
  stepId: number,
): Promise<CmdResult> {
  const sid = Number(stepId);
  try {
    await queryServer(server,
      `EXEC msdb.dbo.sp_start_job @job_id = '${escapeSqlString(jobId)}', @step_name = (
        SELECT js.step_name FROM msdb.dbo.sysjobsteps js WHERE js.job_id = '${escapeSqlString(jobId)}' AND js.step_id = ${sid}
      );`,
    );
    return { success: true, message: `Job started at step ${sid}.` };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, message };
  }
}

/* ================================================================== */
/*  Server Information                                                */
/* ================================================================== */

export async function getServerInfo(server: string): Promise<ServerInfo> {
  const result = await queryServer<ServerInfo>(server, loadSql("server-info"));
  return result.recordset[0];
}

export async function getBufferPool(server: string): Promise<BufferPoolEntry[]> {
  const result = await queryServer<BufferPoolEntry>(server, loadSql("buffer-pool"));
  return result.recordset;
}

export async function getServerServices(server: string): Promise<ServerService[]> {
  const result = await queryServer<ServerService>(server, loadSql("server-services"));
  return result.recordset;
}

export async function getServerConfig(server: string): Promise<ServerConfigOption[]> {
  const result = await queryServer<ServerConfigOption>(server, loadSql("server-config"));
  return result.recordset;
}

/* ================================================================== */
/*  RAM Overview                                                      */
/* ================================================================== */

export async function getRamOverview(server: string): Promise<RamOverview> {
  const result = await queryServer<RamOverview>(server, loadSql("ram-overview"));
  return result.recordset[0];
}

/* ================================================================== */
/*  Database Sizes on Disk                                            */
/* ================================================================== */

export async function getDatabaseSizes(server: string): Promise<DatabaseSizeInfo[]> {
  const result = await queryServer<DatabaseSizeInfo>(server, loadSql("database-sizes"));
  return result.recordset;
}

/* ================================================================== */
/*  Database Overview (rich info for server panel)                     */
/* ================================================================== */

export async function getDatabaseOverview(server: string): Promise<DatabaseOverviewInfo[]> {
  const result = await queryServer<DatabaseOverviewInfo>(server, loadSql("database-overview"));
  return result.recordset;
}

/* ================================================================== */
/*  Availability Groups                                               */
/* ================================================================== */

export async function getAvailabilityGroups(server: string): Promise<AvailabilityGroupInfo[]> {
  try {
    const result = await queryServer<AvailabilityGroupInfo>(server, loadSql("availability-groups"));
    return result.recordset;
  } catch {
    // HADR not enabled or not supported
    return [];
  }
}

/* ================================================================== */
/*  DDL Actions (Create Database, Create Login, Grant)                */
/* ================================================================== */

export async function createDatabase(
  server: string,
  dbName: string,
): Promise<CmdResult> {
  try {
    const name = bracketName(dbName);
    await queryServer(server, `CREATE DATABASE ${name};`);
    return { success: true, message: `Database ${dbName} created.` };
  } catch (e: unknown) {
    return { success: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function createLogin(
  server: string,
  loginName: string,
  password: string,
): Promise<CmdResult> {
  try {
    const name = bracketName(loginName);
    const pwd = escapeSqlString(password);
    await queryServer(server, `CREATE LOGIN ${name} WITH PASSWORD = N'${pwd}';`);
    return { success: true, message: `Login ${loginName} created.` };
  } catch (e: unknown) {
    return { success: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function grantPermission(
  server: string,
  permission: string,
  loginName: string,
): Promise<CmdResult> {
  try {
    const perm = escapeSqlString(permission);
    const name = bracketName(loginName);
    await queryServer(server, `GRANT ${perm} TO ${name};`);
    return { success: true, message: `Granted ${permission} to ${loginName}.` };
  } catch (e: unknown) {
    return { success: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/* ================================================================== */
/*  Database Detail (single DB info, ext properties, DDL history)     */
/* ================================================================== */

export async function getDatabaseDetail(
  server: string,
  dbName: string,
): Promise<DatabaseDetailInfo> {
  const result = await queryDb<DatabaseDetailInfo>(server, dbName, loadSql("database-info"));
  return result.recordset[0];
}

export async function getDatabaseExtProps(
  server: string,
  dbName: string,
): Promise<ExtendedProperty[]> {
  const result = await queryDb<ExtendedProperty>(server, dbName, loadSql("database-extended-properties"));
  return result.recordset;
}

export async function getDatabaseDdlHistory(
  server: string,
  dbName: string,
): Promise<DdlHistoryEvent[]> {
  try {
    const sql = loadSql("database-ddl-history")
      .replace("{{dbName}}", escapeSqlString(dbName));
    const result = await queryServer<DdlHistoryEvent>(server, sql);
    return result.recordset;
  } catch {
    return [];
  }
}

/* ================================================================== */
/*  Table Panel                                                       */
/* ================================================================== */

export async function getTableDetail(
  server: string,
  dbName: string,
  schemaName: string,
  tableName: string,
): Promise<TableDetailInfo> {
  const sql = loadSql("table-detail")
    .replace("{{schemaName}}", escapeSqlString(schemaName))
    .replace("{{tableName}}", escapeSqlString(tableName));
  const result = await queryDb<TableDetailInfo>(server, dbName, sql);
  return result.recordset[0];
}

export async function getTableColumnsDetail(
  server: string,
  dbName: string,
  schemaName: string,
  tableName: string,
): Promise<TableColumnDetail[]> {
  const sql = loadSql("table-columns-detail")
    .replace("{{schemaName}}", escapeSqlString(schemaName))
    .replace("{{tableName}}", escapeSqlString(tableName));
  const result = await queryDb<TableColumnDetail>(server, dbName, sql);
  return result.recordset;
}

export async function getTableTriggers(
  server: string,
  dbName: string,
  schemaName: string,
  tableName: string,
): Promise<TableTriggerInfo[]> {
  const sql = loadSql("table-triggers-detail")
    .replace("{{schemaName}}", escapeSqlString(schemaName))
    .replace("{{tableName}}", escapeSqlString(tableName));
  const result = await queryDb<TableTriggerInfo>(server, dbName, sql);
  return result.recordset;
}

export async function getTablePermissions(
  server: string,
  dbName: string,
  schemaName: string,
  tableName: string,
): Promise<TablePermissionInfo[]> {
  const sql = loadSql("table-permissions")
    .replace("{{schemaName}}", escapeSqlString(schemaName))
    .replace("{{tableName}}", escapeSqlString(tableName));
  const result = await queryDb<TablePermissionInfo>(server, dbName, sql);
  return result.recordset;
}

export async function getTableDataSample(
  server: string,
  dbName: string,
  schemaName: string,
  tableName: string,
): Promise<Record<string, unknown>[]> {
  const sql = `SELECT TOP 10 * FROM ${bracketName(schemaName)}.${bracketName(tableName)};`;
  const result = await queryDb<Record<string, unknown>>(server, dbName, sql);
  return result.recordset;
}

/* ================================================================== */
/*  SQL Module Panel                                                  */
/* ================================================================== */

export async function getModuleInfo(
  server: string,
  dbName: string,
  schemaName: string,
  objectName: string,
): Promise<SqlModuleInfo> {
  const sql = loadSql("module-info")
    .replace("{{schemaName}}", escapeSqlString(schemaName))
    .replace("{{objectName}}", escapeSqlString(objectName));
  const result = await queryDb<SqlModuleInfo>(server, dbName, sql);
  return result.recordset[0];
}

export async function getModuleDefinition(
  server: string,
  dbName: string,
  schemaName: string,
  objectName: string,
): Promise<string> {
  const sql = loadSql("module-definition")
    .replace("{{schemaName}}", escapeSqlString(schemaName))
    .replace("{{objectName}}", escapeSqlString(objectName));
  const result = await queryDb<{ definition: string }>(server, dbName, sql);
  return result.recordset[0]?.definition ?? "";
}

export async function getModuleParameters(
  server: string,
  dbName: string,
  schemaName: string,
  objectName: string,
): Promise<SqlModuleParameter[]> {
  const sql = loadSql("module-parameters")
    .replace("{{schemaName}}", escapeSqlString(schemaName))
    .replace("{{objectName}}", escapeSqlString(objectName));
  const result = await queryDb<SqlModuleParameter>(server, dbName, sql);
  return result.recordset;
}

export async function getModuleDependencies(
  server: string,
  dbName: string,
  schemaName: string,
  objectName: string,
): Promise<SqlModuleDependency[]> {
  try {
    const sql = loadSql("module-dependencies")
      .replace(/\{\{schemaName\}\}/g, escapeSqlString(schemaName))
      .replace(/\{\{objectName\}\}/g, escapeSqlString(objectName));
    const result = await queryDb<SqlModuleDependency>(server, dbName, sql);
    return result.recordset;
  } catch {
    return [];
  }
}
