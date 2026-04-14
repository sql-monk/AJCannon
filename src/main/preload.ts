import { contextBridge, ipcRenderer } from "electron";
import { IpcChannels } from "../shared/types";

/* Expose a safe bridge to the renderer */
contextBridge.exposeInMainWorld("sqlBridge", {
  // App config
  loadAppConfig:        () => ipcRenderer.invoke(IpcChannels.LOAD_APP_CONFIG),
  saveAppConfig:        (cfg: unknown) => ipcRenderer.invoke(IpcChannels.SAVE_APP_CONFIG, cfg),

  // Connection
  connect:              (server: string) => ipcRenderer.invoke(IpcChannels.CONNECT, server),
  disconnect:           (server: string) => ipcRenderer.invoke(IpcChannels.DISCONNECT, server),

  // Object Explorer
  getDatabases:         (server: string) => ipcRenderer.invoke(IpcChannels.GET_DATABASES, server),
  getDatabaseChildren:  (server: string, db: string) =>
                          ipcRenderer.invoke(IpcChannels.GET_DATABASE_CHILDREN, server, db),
  getTableIndexes:      (server: string, db: string, schema: string, table: string) =>
                          ipcRenderer.invoke(IpcChannels.GET_TABLE_INDEXES, server, db, schema, table),
  getTableColumns:      (server: string, db: string, schema: string, table: string) =>
                          ipcRenderer.invoke(IpcChannels.GET_TABLE_COLUMNS, server, db, schema, table),
  getFilegroupFiles:    (server: string, db: string, filegroupId: number) =>
                          ipcRenderer.invoke(IpcChannels.GET_FILEGROUP_FILES, server, db, filegroupId),

  // Overview
  getCpuOverview:       (server: string) => ipcRenderer.invoke(IpcChannels.GET_CPU_OVERVIEW, server),
  getCpuByDb:           (server: string) => ipcRenderer.invoke(IpcChannels.GET_CPU_BY_DB, server),
  getIoByDb:            (server: string) => ipcRenderer.invoke(IpcChannels.GET_IO_BY_DB, server),
  getWaitStats:         (server: string) => ipcRenderer.invoke(IpcChannels.GET_WAIT_STATS, server),
  getBlocking:          (server: string) => ipcRenderer.invoke(IpcChannels.GET_BLOCKING, server),

  // Disk Space drill-down
  getVolumes:           (server: string) => ipcRenderer.invoke(IpcChannels.GET_VOLUMES, server),
  getDbSpace:           (server: string, volumeMountPoint: string) =>
                          ipcRenderer.invoke(IpcChannels.GET_DB_SPACE, server, volumeMountPoint),
  getFileSpace:         (server: string, db: string) =>
                          ipcRenderer.invoke(IpcChannels.GET_FILE_SPACE, server, db),
  getObjectSpace:       (server: string, db: string, fileId: number) =>
                          ipcRenderer.invoke(IpcChannels.GET_OBJECT_SPACE, server, db, fileId),

  // Dashboard
  getServerSummary:     (server: string) => ipcRenderer.invoke(IpcChannels.GET_SERVER_SUMMARY, server),

  // Shrink
  shrink:               (req: unknown) => ipcRenderer.invoke(IpcChannels.SHRINK, req),

  // Current Activity
  getSessions:          (server: string) => ipcRenderer.invoke(IpcChannels.GET_SESSIONS, server),
  getSessionDetail:     (server: string, sessionId: number) =>
                          ipcRenderer.invoke(IpcChannels.GET_SESSION_DETAIL, server, sessionId),
  killSession:          (server: string, sessionId: number) =>
                          ipcRenderer.invoke(IpcChannels.KILL_SESSION, server, sessionId),
  getExpensiveQueries:  (server: string) => ipcRenderer.invoke(IpcChannels.GET_EXPENSIVE_QUERIES, server),

  // Agent
  getAgentJobs:         (server: string) => ipcRenderer.invoke(IpcChannels.GET_AGENT_JOBS, server),
  getJobSteps:          (server: string, jobId: string) =>
                          ipcRenderer.invoke(IpcChannels.GET_JOB_STEPS, server, jobId),
  getJobSchedules:      (server: string, jobId: string) =>
                          ipcRenderer.invoke(IpcChannels.GET_JOB_SCHEDULES, server, jobId),
  getRunningJobs:       (server: string) => ipcRenderer.invoke(IpcChannels.GET_RUNNING_JOBS, server),
  stopAgentJob:         (server: string, jobId: string) =>
                          ipcRenderer.invoke(IpcChannels.STOP_AGENT_JOB, server, jobId),
  toggleAgentJob:       (server: string, jobId: string, enable: boolean) =>
                          ipcRenderer.invoke(IpcChannels.TOGGLE_AGENT_JOB, server, jobId, enable),
  startJobAtStep:       (server: string, jobId: string, stepId: number) =>
                          ipcRenderer.invoke(IpcChannels.START_JOB_AT_STEP, server, jobId, stepId),

  // Server Info
  getServerInfo:        (server: string) => ipcRenderer.invoke(IpcChannels.GET_SERVER_INFO, server),
  getBufferPool:        (server: string) => ipcRenderer.invoke(IpcChannels.GET_BUFFER_POOL, server),
  getServerServices:    (server: string) => ipcRenderer.invoke(IpcChannels.GET_SERVER_SERVICES, server),
  getServerConfig:      (server: string) => ipcRenderer.invoke(IpcChannels.GET_SERVER_CONFIG, server),
  getRamOverview:       (server: string) => ipcRenderer.invoke(IpcChannels.GET_RAM_OVERVIEW, server),
  getDatabaseSizes:     (server: string) => ipcRenderer.invoke(IpcChannels.GET_DATABASE_SIZES, server),
  getDatabaseOverview:  (server: string) => ipcRenderer.invoke(IpcChannels.GET_DATABASE_OVERVIEW, server),
  getDatabaseDetail:    (server: string, dbName: string) => ipcRenderer.invoke(IpcChannels.GET_DATABASE_DETAIL, server, dbName),
  getDatabaseExtProps:  (server: string, dbName: string) => ipcRenderer.invoke(IpcChannels.GET_DATABASE_EXT_PROPS, server, dbName),
  getDatabaseDdlHistory: (server: string, dbName: string) => ipcRenderer.invoke(IpcChannels.GET_DATABASE_DDL_HISTORY, server, dbName),
  getAvailabilityGroups: (server: string) => ipcRenderer.invoke(IpcChannels.GET_AVAILABILITY_GROUPS, server),

  // DDL Actions
  createDatabase:       (server: string, dbName: string) => ipcRenderer.invoke(IpcChannels.CREATE_DATABASE, server, dbName),
  createLogin:          (server: string, loginName: string, password: string) => ipcRenderer.invoke(IpcChannels.CREATE_LOGIN, server, loginName, password),
  grantPermission:      (server: string, permission: string, loginName: string) => ipcRenderer.invoke(IpcChannels.GRANT_PERMISSION, server, permission, loginName),

  // App utilities
  getConfigPath:         () => ipcRenderer.invoke(IpcChannels.GET_CONFIG_PATH),
  getLogContent:         () => ipcRenderer.invoke(IpcChannels.GET_LOG_CONTENT),
  getLogPath:            () => ipcRenderer.invoke(IpcChannels.GET_LOG_PATH),
  getSqlQueries:         () => ipcRenderer.invoke(IpcChannels.GET_SQL_QUERIES),
  openInEditor:          (filePath: string) => ipcRenderer.invoke(IpcChannels.OPEN_IN_EDITOR, filePath),
  openInExplorer:        (filePath: string) => ipcRenderer.invoke(IpcChannels.OPEN_IN_EXPLORER, filePath),

  // Table Panel
  getTableDetail:        (server: string, db: string, schema: string, table: string) =>
                           ipcRenderer.invoke(IpcChannels.GET_TABLE_DETAIL, server, db, schema, table),
  getTableColumnsDetail: (server: string, db: string, schema: string, table: string) =>
                           ipcRenderer.invoke(IpcChannels.GET_TABLE_COLUMNS_DETAIL, server, db, schema, table),
  getTableTriggers:      (server: string, db: string, schema: string, table: string) =>
                           ipcRenderer.invoke(IpcChannels.GET_TABLE_TRIGGERS, server, db, schema, table),
  getTablePermissions:   (server: string, db: string, schema: string, table: string) =>
                           ipcRenderer.invoke(IpcChannels.GET_TABLE_PERMISSIONS, server, db, schema, table),
  getTableDataSample:    (server: string, db: string, schema: string, table: string) =>
                           ipcRenderer.invoke(IpcChannels.GET_TABLE_DATA_SAMPLE, server, db, schema, table),

  // SQL Module Panel
  getModuleInfo:         (server: string, db: string, schema: string, objectName: string) =>
                           ipcRenderer.invoke(IpcChannels.GET_MODULE_INFO, server, db, schema, objectName),
  getModuleDefinition:   (server: string, db: string, schema: string, objectName: string) =>
                           ipcRenderer.invoke(IpcChannels.GET_MODULE_DEFINITION, server, db, schema, objectName),
  getModuleParameters:   (server: string, db: string, schema: string, objectName: string) =>
                           ipcRenderer.invoke(IpcChannels.GET_MODULE_PARAMETERS, server, db, schema, objectName),
  getModuleDependencies: (server: string, db: string, schema: string, objectName: string) =>
                           ipcRenderer.invoke(IpcChannels.GET_MODULE_DEPENDENCIES, server, db, schema, objectName),
});
