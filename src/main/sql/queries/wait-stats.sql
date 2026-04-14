--overview,wait stats
/*
waitType string,
waitCount bigint,
waitTimeMs bigint,
signalWaitMs bigint,
resourceWaitMs bigint
*/
SELECT TOP 20
  ws.wait_type waitType,
  ws.waiting_tasks_count waitCount,
  ws.wait_time_ms waitTimeMs,
  ws.signal_wait_time_ms signalWaitMs,
  ws.wait_time_ms - ws.signal_wait_time_ms resourceWaitMs
FROM sys.dm_os_wait_stats ws (NOLOCK)
WHERE ws.wait_type NOT IN ({{excludeList}})
  AND ws.waiting_tasks_count > 0
ORDER BY ws.wait_time_ms DESC;
