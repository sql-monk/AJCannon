--query store,regressed
/*
query_id bigint,
object_name string,
avg_duration_ms float,
last_duration_ms float,
stddev_duration_ms float,
count_executions bigint,
query_sql_text string
*/
SELECT TOP 50
  q.query_id,
  ISNULL(OBJECT_NAME(q.object_id), '') object_name,
  rs.avg_duration / 1000.0 avg_duration_ms,
  rs.last_duration / 1000.0 last_duration_ms,
  rs.stdev_duration / 1000.0 stddev_duration_ms,
  rs.count_executions,
  CAST(qt.query_sql_text AS NVARCHAR(4000)) query_sql_text
FROM sys.query_store_query q (NOLOCK)
  JOIN sys.query_store_plan p (NOLOCK) ON q.query_id = p.query_id
  JOIN sys.query_store_runtime_stats rs (NOLOCK) ON p.plan_id = rs.plan_id
  JOIN sys.query_store_query_text qt (NOLOCK) ON q.query_text_id = qt.query_text_id
  JOIN sys.query_store_runtime_stats_interval rsi (NOLOCK) ON rs.runtime_stats_interval_id = rsi.runtime_stats_interval_id
WHERE rsi.start_time >= DATEADD(DAY, -7, GETUTCDATE())
  AND rs.avg_duration > rs.last_duration * 1.5
ORDER BY rs.avg_duration DESC;
