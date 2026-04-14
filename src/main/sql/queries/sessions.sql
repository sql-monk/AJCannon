--activity,sessions
/*
sessionId int,
loginName string,
hostName string,
programName string,
status string,
command string,
databaseName string,
cpuTime int,
reads bigint,
writes bigint,
logicalReads bigint,
waitType string,
waitTime int,
blockingSessionId int,
openTransactionCount int,
startTime string,
currentStatement string
*/
SELECT
  s.session_id sessionId,
  s.login_name loginName,
  ISNULL(s.host_name, '') hostName,
  ISNULL(s.program_name, '') programName,
  ISNULL(r.status, s.status) status,
  ISNULL(r.command, '') command,
  ISNULL(DB_NAME(r.database_id), DB_NAME(s.database_id)) databaseName,
  ISNULL(r.cpu_time, s.cpu_time) cpuTime,
  ISNULL(r.reads, 0) reads,
  ISNULL(r.writes, 0) writes,
  ISNULL(r.logical_reads, 0) logicalReads,
  r.wait_type waitType,
  ISNULL(r.wait_time, 0) waitTime,
  ISNULL(r.blocking_session_id, 0) blockingSessionId,
  ISNULL(r.open_transaction_count, 0) openTransactionCount,
  CONVERT(varchar(30), r.start_time, 120) startTime,
  SUBSTRING(
    t.text,
    (r.statement_start_offset / 2) + 1,
    ((CASE r.statement_end_offset
        WHEN -1 THEN DATALENGTH(t.text)
        ELSE r.statement_end_offset
    END - r.statement_start_offset) / 2) + 1
  ) currentStatement
FROM sys.dm_exec_sessions s (NOLOCK)
  LEFT JOIN sys.dm_exec_requests r (NOLOCK) ON s.session_id = r.session_id
  OUTER APPLY sys.dm_exec_sql_text(r.sql_handle) t
WHERE s.session_id > 50
  AND s.is_user_process = 1
ORDER BY s.session_id;
