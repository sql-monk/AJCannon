--activity,expensive queries
/*
executionCount int,
totalCpuMs bigint,
avgCpuMs bigint,
totalReads bigint,
avgReads bigint,
totalDurationMs bigint,
avgDurationMs bigint,
queryText string,
databaseName string,
lastExecutionTime string,
queryPlanXml string
*/
SELECT TOP 30
  qs.execution_count executionCount,
  qs.total_worker_time / 1000 totalCpuMs,
  CASE WHEN qs.execution_count > 0
    THEN qs.total_worker_time / 1000 / qs.execution_count ELSE 0 END avgCpuMs,
  qs.total_logical_reads totalReads,
  CASE WHEN qs.execution_count > 0
    THEN qs.total_logical_reads / qs.execution_count ELSE 0 END avgReads,
  qs.total_elapsed_time / 1000 totalDurationMs,
  CASE WHEN qs.execution_count > 0
    THEN qs.total_elapsed_time / 1000 / qs.execution_count ELSE 0 END avgDurationMs,
  SUBSTRING(t.text, (qs.statement_start_offset / 2) + 1,
    ((CASE qs.statement_end_offset
        WHEN -1 THEN DATALENGTH(t.text)
        ELSE qs.statement_end_offset
    END - qs.statement_start_offset) / 2) + 1) queryText,
  ISNULL(DB_NAME(t.dbid), '') databaseName,
  CONVERT(varchar(30), qs.last_execution_time, 120) lastExecutionTime,
  CONVERT(nvarchar(max), p.query_plan) queryPlanXml
FROM sys.dm_exec_query_stats qs (NOLOCK)
  CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) t
  OUTER APPLY sys.dm_exec_query_plan(qs.plan_handle) p
ORDER BY qs.total_worker_time DESC;
