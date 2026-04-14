--activity,blocking
/*
sessionId int,
blockingSessionId int,
waitType string,
waitTimeMs int,
status string,
databaseName string,
loginName string,
hostName string,
currentStatement string
*/
SELECT
  r.session_id sessionId,
  r.blocking_session_id blockingSessionId,
  r.wait_type waitType,
  r.wait_time waitTimeMs,
  r.status,
  DB_NAME(r.database_id) databaseName,
  s.login_name loginName,
  ISNULL(s.host_name, '') hostName,
  SUBSTRING(t.text, (r.statement_start_offset / 2) + 1,
    ((CASE r.statement_end_offset
        WHEN -1 THEN DATALENGTH(t.text)
        ELSE r.statement_end_offset
    END - r.statement_start_offset) / 2) + 1) currentStatement
FROM sys.dm_exec_requests r (NOLOCK)
  JOIN sys.dm_exec_sessions s (NOLOCK) ON r.session_id = s.session_id
  CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t
WHERE r.blocking_session_id <> 0;
