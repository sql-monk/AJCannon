/* ------------------------------------------------------------------ */
/*  Shared types between main (Electron) and renderer (React)        */
/* ------------------------------------------------------------------ */

// ---- Connection ----
export interface ConnectionConfig {
  server: string;
}

// ---- Tree context (selected node determines right-panel content) ----
export type TreeView = "overview" | "activity" | "agent" | "databases" | "security" | "server" | "configuration" | "alwayson" | "extendedevents" | "db-querystats" | "db-backups" | "db-storage" | "db-security" | "db-tables" | "db-views" | "db-procedures" | "db-scalar-functions" | "db-tvf" | "db-user-types" | "db-qs-regressed" | "db-qs-resource" | "db-qs-forced" | "db-filegroups" | "db-partitioning";

export interface TreeContext {
  server: string;
  view: TreeView;
  database?: string;
}

// ---- Object Explorer ----
export type TreeNodeType =
  | "server"
  | "database"
  | "folder"
  | "table"
  | "view"
  | "procedure"
  | "function"
  | "index"
  | "column"
  | "synonym"
  | "trigger"
  | "user-type"
  | "filegroup"
  | "partition-schema"
  | "partition-function"
  | "backup";

export interface TreeNode {
  id: string;
  label: string;
  type: TreeNodeType;
  children?: TreeNode[];
  meta?: Record<string, unknown>;
}

// ---- Overview (CPU / Waits / Blocking) ----
export interface CpuSnapshot {
  eventTime: string;
  sqlCpu: number;
  systemIdle: number;
  otherCpu: number;
}

export interface CpuByDatabase {
  databaseName: string;
  totalCpuMs: number;
}

export interface WaitStatInfo {
  waitType: string;
  waitCount: number;
  waitTimeMs: number;
  signalWaitMs: number;
  resourceWaitMs: number;
}

export interface BlockingProcess {
  sessionId: number;
  blockingSessionId: number;
  waitType: string;
  waitTimeMs: number;
  status: string;
  command: string;
  databaseName: string;
  loginName: string;
  hostName: string;
  programName: string;
  durationSec: number;
  currentStatement: string;
  fullSql: string;
  queryPlanXml: string;
  lockResourceType: string;
  lockMode: string;
  lockedObject: string;
  waitResource: string;
}

// ---- Disk Space drill-down ----
export interface VolumeSpaceInfo {
  volumeMountPoint: string;
  volumeName: string;
  totalMB: number;
  freeMB: number;
  usedMB: number;
}

export interface DatabaseSpaceOnVolume {
  databaseName: string;
  databaseId: number;
  volumeMountPoint: string;
  totalSizeMB: number;
}

export interface FileSpaceInfo {
  fileId: number;
  fileName: string;
  fileType: string;
  physicalName: string;
  filegroupName: string;
  sizeMB: number;
  usedMB: number;
  freeMB: number;
}

export interface ObjectSpaceInfo {
  schemaName: string;
  tableName: string;
  totalSpaceMB: number;
  usedSpaceMB: number;
  rowCount: number;
}

// ---- Current Activity (sessions) ----
export interface SessionInfo {
  sessionId: number;
  loginName: string;
  hostName: string;
  programName: string;
  status: string;
  command: string;
  databaseName: string;
  cpuTime: number;
  reads: number;
  writes: number;
  logicalReads: number;
  waitType: string | null;
  waitTime: number;
  blockingSessionId: number;
  openTransactionCount: number;
  currentStatement: string | null;
  startTime: string | null;
}

export interface SessionDetail {
  queryText: string;
  queryPlan: string | null;
}

// ---- Dashboard (root node) ----
export interface ServerSummary {
  server: string;
  sqlCpu: number;
  runningCount: number;
  runnableCount: number;
  suspendedCount: number;
  blockingCount: number;
  maxBlockedWaitSec: number;
}

// ---- Shrink ----
export interface ShrinkRequest {
  server: string;
  databaseName: string;
  fileId?: number;
  targetSizeMB?: number;
}

export interface ShrinkResult {
  success: boolean;
  message: string;
}

// ---- Expensive Queries ----
export interface ExpensiveQuery {
  executionCount: number;
  totalCpuMs: number;
  avgCpuMs: number;
  totalReads: number;
  avgReads: number;
  totalDurationMs: number;
  avgDurationMs: number;
  queryText: string;
  databaseName: string;
  lastExecutionTime: string;
  queryPlanXml: string | null;
}

// ---- SQL Agent ----
export interface AgentJob {
  jobId: string;
  jobName: string;
  enabled: boolean;
  description: string;
  lastRunDate: string | null;
  lastRunOutcome: string;
  currentlyExecuting: boolean;
}

export interface AgentJobStep {
  stepId: number;
  stepName: string;
  subsystem: string;
}

export interface RunningJob {
  jobId: string;
  jobName: string;
  startTime: string;
  currentStep: number;
  currentStepName: string;
}

// ---- Server info ----
export interface ServerInfo {
  productVersion: string;
  edition: string;
  cpuCount: number;
  hyperthreadRatio: number;
  physicalMemoryMB: number;
  maxDop: number;
  costThreshold: number;
  maxMemoryMB: number;
  minMemoryMB: number;
  currentCpuPercent: number;
  totalServerMemoryMB: number;
  targetServerMemoryMB: number;
}

export interface BufferPoolEntry {
  databaseName: string;
  sizeMB: number;
}

export interface ServerService {
  serviceName: string;
  startupType: string;
  status: string;
  lastStartupTime: string | null;
  serviceAccount: string;
}

export interface ServerConfigOption {
  name: string;
  minimum: number;
  maximum: number;
  configValue: number;
  runValue: number;
}

// ---- RAM Overview ----
export interface RamOverview {
  physicalMemoryGB: number;
  committedMemoryGB: number;
  committedTargetGB: number;
  sqlUsedMemoryGB: number;
  sqlTargetMemoryGB: number;
  sqlMaxMemoryGB: number;
  sqlMinMemoryGB: number;
  pageLifeExpectancy: number;
  bufferCacheHitRatio: number;
  memoryGrantsPending: number;
}

// ---- Database sizes on disk ----
export interface DatabaseSizeInfo {
  databaseName: string;
  databaseId: number;
  stateDesc: string;
  dataSizeGB: number;
  logSizeGB: number;
  totalSizeGB: number;
}

// ---- Database overview (rich info for server panel) ----
export interface DatabaseOverviewInfo {
  databaseName: string;
  databaseId: number;
  stateDesc: string;
  dataSizeMB: number;
  logSizeMB: number;
  logFreeSpaceMB: number;
  dataFileCount: number;
  logFileCount: number;
  logReuseWaitDesc: string;
  agName: string | null;
  agSyncState: string | null;
  dbOwner: string;
}

// ---- Availability Groups ----
export interface AvailabilityGroupInfo {
  agName: string;
  agId: string;
  primaryReplica: string;
  synchronizationHealth: string;
  databaseName: string;
  databaseState: string;
  synchronizationState: string;
  isLocal: boolean;
  replicaServerName: string;
  availabilityMode: string;
  failoverMode: string;
  replicaRole: string;
}

// ---- Generic command result ----
export interface CmdResult {
  success: boolean;
  message: string;
}

// ---- IPC channel names ----
export const IpcChannels = {
  CONNECT:               "sql:connect",
  DISCONNECT:            "sql:disconnect",
  GET_DATABASES:         "sql:get-databases",
  GET_DATABASE_CHILDREN: "sql:get-database-children",
  GET_TABLE_INDEXES:     "sql:get-table-indexes",
  GET_TABLE_COLUMNS:     "sql:get-table-columns",
  GET_FILEGROUP_FILES:   "sql:get-filegroup-files",
  GET_VOLUMES:           "sql:get-volumes",
  GET_DB_SPACE:          "sql:get-db-space",
  GET_FILE_SPACE:        "sql:get-file-space",
  GET_OBJECT_SPACE:      "sql:get-object-space",
  GET_CPU_OVERVIEW:      "sql:get-cpu-overview",
  GET_CPU_BY_DB:         "sql:get-cpu-by-db",
  GET_WAIT_STATS:        "sql:get-wait-stats",
  GET_BLOCKING:          "sql:get-blocking",
  GET_SERVER_SUMMARY:    "sql:get-server-summary",
  SHRINK:                "sql:shrink",
  GET_SESSIONS:          "sql:get-sessions",
  GET_SESSION_DETAIL:    "sql:get-session-detail",
  KILL_SESSION:          "sql:kill-session",
  GET_EXPENSIVE_QUERIES: "sql:get-expensive-queries",
  GET_AGENT_JOBS:        "sql:get-agent-jobs",
  GET_JOB_STEPS:         "sql:get-job-steps",
  GET_RUNNING_JOBS:      "sql:get-running-jobs",
  STOP_AGENT_JOB:        "sql:stop-agent-job",
  TOGGLE_AGENT_JOB:      "sql:toggle-agent-job",
  START_JOB_AT_STEP:     "sql:start-job-at-step",
  GET_SERVER_INFO:        "sql:get-server-info",
  GET_BUFFER_POOL:        "sql:get-buffer-pool",
  GET_SERVER_SERVICES:    "sql:get-server-services",
  GET_SERVER_CONFIG:      "sql:get-server-config",
  GET_RAM_OVERVIEW:       "sql:get-ram-overview",
  GET_DATABASE_SIZES:     "sql:get-database-sizes",
  GET_DATABASE_OVERVIEW:  "sql:get-database-overview",
  GET_AVAILABILITY_GROUPS: "sql:get-availability-groups",
  CREATE_DATABASE:         "sql:create-database",
  CREATE_LOGIN:            "sql:create-login",
  GRANT_PERMISSION:        "sql:grant-permission",
  LOAD_APP_CONFIG:        "app:load-config",
  SAVE_APP_CONFIG:        "app:save-config",
  GET_CONFIG_PATH:        "app:get-config-path",
  GET_LOG_CONTENT:        "app:get-log-content",
  GET_LOG_PATH:           "app:get-log-path",
  GET_SQL_QUERIES:        "app:get-sql-queries",
  OPEN_IN_EDITOR:         "app:open-in-editor",
  OPEN_IN_EXPLORER:       "app:open-in-explorer",
} as const;
