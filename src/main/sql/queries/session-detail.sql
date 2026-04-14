--activity,session detail
/*
queryText string,
queryPlan string
*/
SELECT
  t.text queryText,
  CONVERT(nvarchar(max), p.query_plan) queryPlan
FROM sys.dm_exec_requests r (NOLOCK)
  CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t
  OUTER APPLY sys.dm_exec_query_plan(r.plan_handle) p
WHERE r.session_id = {{sessionId}};
