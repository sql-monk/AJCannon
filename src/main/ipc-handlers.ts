import { ipcMain } from "electron";
import { IpcChannels } from "../shared/types";
import type { ShrinkRequest } from "../shared/types";
import { connectServer, disconnectServer } from "./sql/connection";
import { loadConfig, saveConfig, addServer, removeServer } from "./config";
import type { AppConfig } from "./config";
import { getLogContent, getLogPath, getConfigPath } from "./logger";
import { shell } from "electron";
import * as Q from "./sql/queries";

export function registerIpcHandlers(): void {
  // ---- App config ----
  ipcMain.handle(IpcChannels.LOAD_APP_CONFIG, async () => {
    return loadConfig();
  });

  ipcMain.handle(IpcChannels.SAVE_APP_CONFIG, async (_e, cfg: AppConfig) => {
    saveConfig(cfg);
    return { ok: true };
  });

  ipcMain.handle(IpcChannels.CONNECT, async (_e, server: string) => {
    await connectServer(server);
    addServer(server);
    return { ok: true };
  });

  ipcMain.handle(IpcChannels.DISCONNECT, async (_e, server: string) => {
    await disconnectServer(server);
    removeServer(server);
    return { ok: true };
  });

  // ---- Object Explorer ----
  ipcMain.handle(IpcChannels.GET_DATABASES, async (_e, server: string) => {
    return Q.getDatabases(server);
  });

  ipcMain.handle(IpcChannels.GET_DATABASE_CHILDREN, async (_e, server: string, db: string) => {
    return Q.getDatabaseChildren(server, db);
  });

  ipcMain.handle(
    IpcChannels.GET_TABLE_INDEXES,
    async (_e, server: string, db: string, schema: string, table: string) => {
      return Q.getTableIndexes(server, db, schema, table);
    },
  );

  ipcMain.handle(
    IpcChannels.GET_TABLE_COLUMNS,
    async (_e, server: string, db: string, schema: string, table: string) => {
      return Q.getTableColumns(server, db, schema, table);
    },
  );

  ipcMain.handle(
    IpcChannels.GET_FILEGROUP_FILES,
    async (_e, server: string, db: string, filegroupId: number) => {
      return Q.getFilegroupFiles(server, db, filegroupId);
    },
  );

  // ---- Overview ----
  ipcMain.handle(IpcChannels.GET_CPU_OVERVIEW, async (_e, server: string) => {
    return Q.getCpuOverview(server);
  });

  ipcMain.handle(IpcChannels.GET_CPU_BY_DB, async (_e, server: string) => {
    return Q.getCpuByDb(server);
  });

  ipcMain.handle(IpcChannels.GET_IO_BY_DB, async (_e, server: string) => {
    return Q.getIoByDb(server);
  });

  ipcMain.handle(IpcChannels.GET_WAIT_STATS, async (_e, server: string) => {
    return Q.getWaitStats(server);
  });

  ipcMain.handle(IpcChannels.GET_BLOCKING, async (_e, server: string) => {
    return Q.getBlocking(server);
  });

  // ---- Disk Space drill-down ----
  ipcMain.handle(IpcChannels.GET_VOLUMES, async (_e, server: string) => {
    return Q.getVolumes(server);
  });

  ipcMain.handle(IpcChannels.GET_DB_SPACE, async (_e, server: string, volumeMountPoint: string) => {
    return Q.getDbSpaceOnVolume(server, volumeMountPoint);
  });

  ipcMain.handle(IpcChannels.GET_FILE_SPACE, async (_e, server: string, db: string) => {
    return Q.getFileSpace(server, db);
  });

  ipcMain.handle(IpcChannels.GET_OBJECT_SPACE, async (_e, server: string, db: string, fileId: number) => {
    return Q.getObjectSpace(server, db, fileId);
  });

  // ---- Dashboard ----
  ipcMain.handle(IpcChannels.GET_SERVER_SUMMARY, async (_e, server: string) => {
    return Q.getServerSummary(server);
  });

  ipcMain.handle(IpcChannels.SHRINK, async (_e, req: ShrinkRequest) => {
    return Q.shrink(req);
  });

  // ---- Current Activity ----
  ipcMain.handle(IpcChannels.GET_SESSIONS, async (_e, server: string) => {
    return Q.getSessions(server);
  });

  ipcMain.handle(IpcChannels.GET_SESSION_DETAIL, async (_e, server: string, sessionId: number) => {
    return Q.getSessionDetail(server, sessionId);
  });

  ipcMain.handle(IpcChannels.KILL_SESSION, async (_e, server: string, sessionId: number) => {
    return Q.killSession(server, sessionId);
  });

  // ---- Expensive Queries ----
  ipcMain.handle(IpcChannels.GET_EXPENSIVE_QUERIES, async (_e, server: string) => {
    return Q.getExpensiveQueries(server);
  });

  // ---- Agent ----
  ipcMain.handle(IpcChannels.GET_AGENT_JOBS, async (_e, server: string) => {
    return Q.getAgentJobs(server);
  });

  ipcMain.handle(IpcChannels.GET_JOB_STEPS, async (_e, server: string, jobId: string) => {
    return Q.getJobSteps(server, jobId);
  });

  ipcMain.handle(IpcChannels.GET_JOB_SCHEDULES, async (_e, server: string, jobId: string) => {
    return Q.getJobSchedules(server, jobId);
  });

  ipcMain.handle(IpcChannels.GET_RUNNING_JOBS, async (_e, server: string) => {
    return Q.getRunningJobs(server);
  });

  ipcMain.handle(IpcChannels.STOP_AGENT_JOB, async (_e, server: string, jobId: string) => {
    return Q.stopAgentJob(server, jobId);
  });

  ipcMain.handle(IpcChannels.TOGGLE_AGENT_JOB, async (_e, server: string, jobId: string, enable: boolean) => {
    return Q.toggleAgentJob(server, jobId, enable);
  });

  ipcMain.handle(IpcChannels.START_JOB_AT_STEP, async (_e, server: string, jobId: string, stepId: number) => {
    return Q.startJobAtStep(server, jobId, stepId);
  });

  // ---- Server Info ----
  ipcMain.handle(IpcChannels.GET_SERVER_INFO, async (_e, server: string) => {
    return Q.getServerInfo(server);
  });

  ipcMain.handle(IpcChannels.GET_BUFFER_POOL, async (_e, server: string) => {
    return Q.getBufferPool(server);
  });

  ipcMain.handle(IpcChannels.GET_SERVER_SERVICES, async (_e, server: string) => {
    return Q.getServerServices(server);
  });

  ipcMain.handle(IpcChannels.GET_SERVER_CONFIG, async (_e, server: string) => {
    return Q.getServerConfig(server);
  });

  ipcMain.handle(IpcChannels.GET_RAM_OVERVIEW, async (_e, server: string) => {
    return Q.getRamOverview(server);
  });

  ipcMain.handle(IpcChannels.GET_DATABASE_SIZES, async (_e, server: string) => {
    return Q.getDatabaseSizes(server);
  });

  ipcMain.handle(IpcChannels.GET_DATABASE_OVERVIEW, async (_e, server: string) => {
    return Q.getDatabaseOverview(server);
  });

  ipcMain.handle(IpcChannels.GET_DATABASE_DETAIL, async (_e, server: string, dbName: string) => {
    return Q.getDatabaseDetail(server, dbName);
  });

  ipcMain.handle(IpcChannels.GET_DATABASE_EXT_PROPS, async (_e, server: string, dbName: string) => {
    return Q.getDatabaseExtProps(server, dbName);
  });

  ipcMain.handle(IpcChannels.GET_DATABASE_DDL_HISTORY, async (_e, server: string, dbName: string) => {
    return Q.getDatabaseDdlHistory(server, dbName);
  });

  ipcMain.handle(IpcChannels.GET_AVAILABILITY_GROUPS, async (_e, server: string) => {
    return Q.getAvailabilityGroups(server);
  });

  // ---- DDL Actions ----
  ipcMain.handle(IpcChannels.CREATE_DATABASE, async (_e, server: string, dbName: string) => {
    return Q.createDatabase(server, dbName);
  });

  ipcMain.handle(IpcChannels.CREATE_LOGIN, async (_e, server: string, loginName: string, password: string) => {
    return Q.createLogin(server, loginName, password);
  });

  ipcMain.handle(IpcChannels.GRANT_PERMISSION, async (_e, server: string, permission: string, loginName: string) => {
    return Q.grantPermission(server, permission, loginName);
  });

  // ---- App utilities ----
  ipcMain.handle(IpcChannels.GET_CONFIG_PATH, async () => getConfigPath());
  ipcMain.handle(IpcChannels.GET_LOG_CONTENT, async () => getLogContent());
  ipcMain.handle(IpcChannels.GET_LOG_PATH, async () => getLogPath());
  ipcMain.handle(IpcChannels.GET_SQL_QUERIES, async () => Q.getAllSqlQueries());
  ipcMain.handle(IpcChannels.OPEN_IN_EDITOR, async (_e, filePath: string) => {
    shell.openPath(filePath);
  });
  ipcMain.handle(IpcChannels.OPEN_IN_EXPLORER, async (_e, filePath: string) => {
    shell.showItemInFolder(filePath);
  });

  // ---- Table Panel ----
  ipcMain.handle(IpcChannels.GET_TABLE_DETAIL,
    async (_e, server: string, db: string, schema: string, table: string) =>
      Q.getTableDetail(server, db, schema, table));

  ipcMain.handle(IpcChannels.GET_TABLE_COLUMNS_DETAIL,
    async (_e, server: string, db: string, schema: string, table: string) =>
      Q.getTableColumnsDetail(server, db, schema, table));

  ipcMain.handle(IpcChannels.GET_TABLE_TRIGGERS,
    async (_e, server: string, db: string, schema: string, table: string) =>
      Q.getTableTriggers(server, db, schema, table));

  ipcMain.handle(IpcChannels.GET_TABLE_PERMISSIONS,
    async (_e, server: string, db: string, schema: string, table: string) =>
      Q.getTablePermissions(server, db, schema, table));

  ipcMain.handle(IpcChannels.GET_TABLE_DATA_SAMPLE,
    async (_e, server: string, db: string, schema: string, table: string) =>
      Q.getTableDataSample(server, db, schema, table));

  // ---- SQL Module Panel ----
  ipcMain.handle(IpcChannels.GET_MODULE_INFO,
    async (_e, server: string, db: string, schema: string, objectName: string) =>
      Q.getModuleInfo(server, db, schema, objectName));

  ipcMain.handle(IpcChannels.GET_MODULE_DEFINITION,
    async (_e, server: string, db: string, schema: string, objectName: string) =>
      Q.getModuleDefinition(server, db, schema, objectName));

  ipcMain.handle(IpcChannels.GET_MODULE_PARAMETERS,
    async (_e, server: string, db: string, schema: string, objectName: string) =>
      Q.getModuleParameters(server, db, schema, objectName));

  ipcMain.handle(IpcChannels.GET_MODULE_DEPENDENCIES,
    async (_e, server: string, db: string, schema: string, objectName: string) =>
      Q.getModuleDependencies(server, db, schema, objectName));
}
