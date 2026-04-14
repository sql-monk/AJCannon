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
} from "../shared/types";

/** SQL query file descriptor */
export interface SqlQueryFile {
  name: string;
  fileName: string;
  filePath: string;
  content: string;
  tags: string[];
}

/** App config (persisted) */
export interface AppConfig {
  servers: string[];
  executionTimeoutSec: number;
  connectionTimeoutSec: number;
}

/** Typed bridge exposed by preload.ts via contextBridge */
export interface SqlBridge {
  // App config
  loadAppConfig(): Promise<AppConfig>;
  saveAppConfig(cfg: AppConfig): Promise<{ ok: boolean }>;

  // Connection
  connect(server: string): Promise<{ ok: boolean }>;
  disconnect(server: string): Promise<{ ok: boolean }>;

  // Object Explorer
  getDatabases(server: string): Promise<TreeNode[]>;
  getDatabaseChildren(server: string, db: string): Promise<TreeNode[]>;
  getTableIndexes(server: string, db: string, schema: string, table: string): Promise<TreeNode[]>;
  getTableColumns(server: string, db: string, schema: string, table: string): Promise<TreeNode[]>;
  getFilegroupFiles(server: string, db: string, filegroupId: number): Promise<TreeNode[]>;

  // Overview
  getCpuOverview(server: string): Promise<CpuSnapshot[]>;
  getCpuByDb(server: string): Promise<CpuByDatabase[]>;
  getIoByDb(server: string): Promise<IoByDatabase[]>;
  getWaitStats(server: string): Promise<WaitStatInfo[]>;
  getBlocking(server: string): Promise<BlockingProcess[]>;

  // Disk Space drill-down
  getVolumes(server: string): Promise<VolumeSpaceInfo[]>;
  getDbSpace(server: string, volumeMountPoint: string): Promise<DatabaseSpaceOnVolume[]>;
  getFileSpace(server: string, db: string): Promise<FileSpaceInfo[]>;
  getObjectSpace(server: string, db: string, fileId: number): Promise<ObjectSpaceInfo[]>;

  // Dashboard
  getServerSummary(server: string): Promise<ServerSummary>;

  // Shrink
  shrink(req: ShrinkRequest): Promise<ShrinkResult>;

  // Current Activity
  getSessions(server: string): Promise<SessionInfo[]>;
  getSessionDetail(server: string, sessionId: number): Promise<SessionDetail | null>;
  killSession(server: string, sessionId: number): Promise<CmdResult>;
  getExpensiveQueries(server: string): Promise<ExpensiveQuery[]>;

  // Agent
  getAgentJobs(server: string): Promise<AgentJob[]>;
  getJobSteps(server: string, jobId: string): Promise<AgentJobStep[]>;
  getJobSchedules(server: string, jobId: string): Promise<AgentJobSchedule[]>;
  getRunningJobs(server: string): Promise<RunningJob[]>;
  stopAgentJob(server: string, jobId: string): Promise<CmdResult>;
  toggleAgentJob(server: string, jobId: string, enable: boolean): Promise<CmdResult>;
  startJobAtStep(server: string, jobId: string, stepId: number): Promise<CmdResult>;

  // Server Info
  getServerInfo(server: string): Promise<ServerInfo>;
  getBufferPool(server: string): Promise<BufferPoolEntry[]>;
  getServerServices(server: string): Promise<ServerService[]>;
  getServerConfig(server: string): Promise<ServerConfigOption[]>;
  getRamOverview(server: string): Promise<RamOverview>;
  getDatabaseSizes(server: string): Promise<DatabaseSizeInfo[]>;
  getDatabaseOverview(server: string): Promise<DatabaseOverviewInfo[]>;
  getDatabaseDetail(server: string, dbName: string): Promise<DatabaseDetailInfo>;
  getDatabaseExtProps(server: string, dbName: string): Promise<ExtendedProperty[]>;
  getDatabaseDdlHistory(server: string, dbName: string): Promise<DdlHistoryEvent[]>;
  getAvailabilityGroups(server: string): Promise<AvailabilityGroupInfo[]>;

  // DDL Actions
  createDatabase(server: string, dbName: string): Promise<CmdResult>;
  createLogin(server: string, loginName: string, password: string): Promise<CmdResult>;
  grantPermission(server: string, permission: string, loginName: string): Promise<CmdResult>;

  // App utilities
  getConfigPath(): Promise<string>;
  getLogContent(): Promise<string>;
  getLogPath(): Promise<string>;
  getSqlQueries(): Promise<SqlQueryFile[]>;
  openInEditor(filePath: string): Promise<void>;
  openInExplorer(filePath: string): Promise<void>;

  // Table Panel
  getTableDetail(server: string, db: string, schema: string, table: string): Promise<TableDetailInfo>;
  getTableColumnsDetail(server: string, db: string, schema: string, table: string): Promise<TableColumnDetail[]>;
  getTableTriggers(server: string, db: string, schema: string, table: string): Promise<TableTriggerInfo[]>;
  getTablePermissions(server: string, db: string, schema: string, table: string): Promise<TablePermissionInfo[]>;
  getTableDataSample(server: string, db: string, schema: string, table: string): Promise<Record<string, unknown>[]>;

  // SQL Module Panel
  getModuleInfo(server: string, db: string, schema: string, objectName: string): Promise<SqlModuleInfo>;
  getModuleDefinition(server: string, db: string, schema: string, objectName: string): Promise<string>;
  getModuleParameters(server: string, db: string, schema: string, objectName: string): Promise<SqlModuleParameter[]>;
  getModuleDependencies(server: string, db: string, schema: string, objectName: string): Promise<SqlModuleDependency[]>;
}

declare global {
  interface Window {
    sqlBridge: SqlBridge;
  }
}

export const bridge: SqlBridge = window.sqlBridge;
