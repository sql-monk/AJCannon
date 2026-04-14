--database,overview,info
/*
databaseName string,
totalSizeMB decimal,
lastBackupDate string,
tableCount int,
sqlModuleCount int,
filegroupCount int,
fileCount int
*/
SELECT
  DB_NAME() databaseName,
  (SELECT CONVERT(decimal(18,2), SUM(size) * 8.0 / 1024.0) FROM sys.database_files (NOLOCK)) totalSizeMB,
  (SELECT CONVERT(varchar(30), MAX(bs.backup_finish_date), 120)
   FROM msdb.dbo.backupset bs (NOLOCK)
   WHERE bs.database_name = DB_NAME()
     AND bs.type = 'D') lastBackupDate,
  (SELECT COUNT(*) FROM sys.tables (NOLOCK)) tableCount,
  (SELECT COUNT(*) FROM sys.sql_modules (NOLOCK)) sqlModuleCount,
  (SELECT COUNT(*) FROM sys.filegroups (NOLOCK)) filegroupCount,
  (SELECT COUNT(*) FROM sys.database_files (NOLOCK)) fileCount;
