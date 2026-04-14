--query store,forced plans
/*
query_id bigint,
plan_id bigint,
object_name string,
count_executions bigint,
avg_duration_ms float,
is_forced_plan bit,
query_sql_text string
*/
SELECT
  q.query_id,
  p.plan_id,
  ISNULL(OBJECT_NAME(q.object_id), '') object_name,
  rs.count_executions,
  rs.avg_duration / 1000.0 avg_duration_ms,
  p.is_forced_plan,
  CAST(qt.query_sql_text AS NVARCHAR(4000)) query_sql_text
FROM sys.query_store_query q (NOLOCK)
  JOIN sys.query_store_plan p (NOLOCK) ON q.query_id = p.query_id
  JOIN sys.query_store_runtime_stats rs (NOLOCK) ON p.plan_id = rs.plan_id
  JOIN sys.query_store_query_text qt (NOLOCK) ON q.query_text_id = qt.query_text_id
WHERE p.is_forced_plan = 1
ORDER BY rs.avg_duration DESC;
