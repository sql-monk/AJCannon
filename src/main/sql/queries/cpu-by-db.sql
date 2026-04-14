--overview,cpu,database
/*
databaseName string,
totalCpuMs bigint
*/
SELECT
  DB_NAME(qt.dbid) databaseName,
  SUM(qs.total_worker_time) / 1000 totalCpuMs
FROM sys.dm_exec_query_stats qs (NOLOCK)
  CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) qt
WHERE qt.dbid IS NOT NULL
  AND qt.dbid > 4
GROUP BY qt.dbid
ORDER BY totalCpuMs DESC;
