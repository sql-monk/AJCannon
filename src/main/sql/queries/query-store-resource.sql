--query store,resource consuming
/*
query_id bigint,
object_name string,
count_executions bigint,
avg_cpu_ms float,
avg_duration_ms float,
avg_logical_reads float,
total_cpu_ms float,
query_sql_text string
*/
SELECT TOP 50
  q.query_id,
  ISNULL(OBJECT_NAME(q.object_id), '') object_name,
  rs.count_executions,
  rs.avg_cpu_time / 1000.0 avg_cpu_ms,
  rs.avg_duration / 1000.0 avg_duration_ms,
  rs.avg_logical_io_reads avg_logical_reads,
  rs.avg_cpu_time / 1000.0 * rs.count_executions total_cpu_ms,
  CAST(qt.query_sql_text AS NVARCHAR(4000)) query_sql_text
FROM sys.query_store_query q (NOLOCK)
  JOIN sys.query_store_plan p (NOLOCK) ON q.query_id = p.query_id
  JOIN sys.query_store_runtime_stats rs (NOLOCK) ON p.plan_id = rs.plan_id
  JOIN sys.query_store_query_text qt (NOLOCK) ON q.query_text_id = qt.query_text_id
  JOIN sys.query_store_runtime_stats_interval rsi (NOLOCK) ON rs.runtime_stats_interval_id = rsi.runtime_stats_interval_id
WHERE rsi.start_time >= DATEADD(DAY, -7, GETUTCDATE())
ORDER BY rs.avg_cpu_time * rs.count_executions DESC;
