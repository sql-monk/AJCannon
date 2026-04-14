--activity,blocking
/*
sessionId int,
blockingSessionId int,
waitType string,
waitTimeMs int,
status string,
command string,
databaseName string,
loginName string,
hostName string,
programName string,
durationSec int,
currentStatement string,
fullSql string,
queryPlanXml string,
lockResourceType string,
lockMode string,
lockedObject string,
waitResource string
*/
;WITH blocked_sessions AS (
    SELECT r.session_id, r.blocking_session_id
    FROM sys.dm_exec_requests r (NOLOCK)
    WHERE r.blocking_session_id <> 0
),
all_involved AS (
    SELECT DISTINCT b.blocking_session_id AS session_id, CAST(0 AS INT) AS blocking_session_id
    FROM blocked_sessions b
    WHERE b.blocking_session_id NOT IN (SELECT bs.session_id FROM blocked_sessions bs)
    UNION ALL
    SELECT bs2.session_id, bs2.blocking_session_id FROM blocked_sessions bs2
),
lock_waits AS (
    SELECT
        tl.request_session_id AS session_id,
        tl.resource_type,
        tl.request_mode,
        tl.resource_database_id,
        CASE tl.resource_type
            WHEN 'OBJECT'
            THEN OBJECT_NAME(tl.resource_associated_entity_id, tl.resource_database_id)
            ELSE NULL
        END AS locked_object_direct,
        tl.resource_associated_entity_id,
        ROW_NUMBER() OVER (PARTITION BY tl.request_session_id ORDER BY tl.resource_type) AS rn
    FROM sys.dm_tran_locks tl (NOLOCK)
    WHERE tl.request_status = 'WAIT'
      AND tl.request_session_id IN (SELECT bs3.session_id FROM blocked_sessions bs3)
),
lock_resolved AS (
    SELECT
        lw.session_id,
        lw.resource_type AS lock_resource_type,
        lw.request_mode AS lock_mode,
        ISNULL(
            lw.locked_object_direct,
            (SELECT TOP 1 OBJECT_NAME(tl2.resource_associated_entity_id, tl2.resource_database_id)
             FROM sys.dm_tran_locks tl2 (NOLOCK)
             WHERE tl2.resource_type = 'OBJECT'
               AND tl2.resource_database_id = lw.resource_database_id
               AND tl2.request_status = 'GRANT'
               AND tl2.request_session_id = (
                   SELECT TOP 1 bs4.blocking_session_id
                   FROM blocked_sessions bs4
                   WHERE bs4.session_id = lw.session_id
               )
            )
        ) AS locked_object
    FROM lock_waits lw
    WHERE lw.rn = 1
)
SELECT
    ai.session_id                                                   AS sessionId,
    ai.blocking_session_id                                          AS blockingSessionId,
    ISNULL(r.wait_type, '')                                         AS waitType,
    ISNULL(r.wait_time, 0)                                          AS waitTimeMs,
    ISNULL(r.status, s.status)                                      AS [status],
    ISNULL(r.command, '')                                            AS command,
    ISNULL(DB_NAME(r.database_id), DB_NAME(s.database_id))          AS databaseName,
    s.login_name                                                    AS loginName,
    ISNULL(s.host_name, '')                                         AS hostName,
    ISNULL(s.program_name, '')                                      AS programName,
    DATEDIFF(SECOND,
        ISNULL(r.start_time, s.last_request_start_time),
        GETDATE())                                                  AS durationSec,
    ISNULL(
        CASE WHEN r.sql_handle IS NOT NULL THEN
            SUBSTRING(qt.text, (r.statement_start_offset / 2) + 1,
                ((CASE r.statement_end_offset
                    WHEN -1 THEN DATALENGTH(qt.text)
                    ELSE r.statement_end_offset
                END - r.statement_start_offset) / 2) + 1)
        ELSE ct.text
        END, '')                                                    AS currentStatement,
    ISNULL(qt.text, ISNULL(ct.text, ''))                            AS fullSql,
    ISNULL(TRY_CONVERT(NVARCHAR(MAX), qp.query_plan), '')           AS queryPlanXml,
    ISNULL(lr.lock_resource_type, '')                               AS lockResourceType,
    ISNULL(lr.lock_mode, '')                                        AS lockMode,
    ISNULL(lr.locked_object, '')                                    AS lockedObject,
    ISNULL(r.wait_resource, '')                                     AS waitResource
FROM all_involved ai
    JOIN sys.dm_exec_sessions s (NOLOCK)         ON ai.session_id = s.session_id
    LEFT JOIN sys.dm_exec_requests r (NOLOCK)    ON ai.session_id = r.session_id
    LEFT JOIN sys.dm_exec_connections c (NOLOCK)  ON ai.session_id = c.session_id
    OUTER APPLY sys.dm_exec_sql_text(r.sql_handle) qt
    OUTER APPLY sys.dm_exec_sql_text(c.most_recent_sql_handle) ct
    OUTER APPLY sys.dm_exec_query_plan(r.plan_handle) qp
    LEFT JOIN lock_resolved lr ON ai.session_id = lr.session_id
ORDER BY ai.blocking_session_id, ai.session_id;
