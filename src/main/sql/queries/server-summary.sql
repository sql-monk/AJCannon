--dashboard,server summary
/*
sqlCpu int,
runningCount int,
runnableCount int,
suspendedCount int,
blockingCount int,
maxBlockedWaitSec int
*/
SELECT
  (
    SELECT TOP 1
      CONVERT(int, record.value('(./Record/SchedulerMonitorEvent/SystemHealth/ProcessUtilization)[1]', 'int'))
    FROM (
      SELECT CONVERT(xml, rb.record) record
      FROM sys.dm_os_ring_buffers rb (NOLOCK)
      WHERE rb.ring_buffer_type = N'RING_BUFFER_SCHEDULER_MONITOR'
        AND rb.record LIKE N'%<SystemHealth>%'
    ) rb
  ) sqlCpu,
  (
    SELECT COUNT(*)
    FROM sys.dm_exec_requests r (NOLOCK)
    WHERE r.session_id > 50
      AND r.status = 'running'
  ) runningCount,
  (
    SELECT COUNT(*)
    FROM sys.dm_exec_requests r (NOLOCK)
    WHERE r.session_id > 50
      AND r.status = 'runnable'
  ) runnableCount,
  (
    SELECT COUNT(*)
    FROM sys.dm_exec_requests r (NOLOCK)
    WHERE r.session_id > 50
      AND r.status = 'suspended'
  ) suspendedCount,
  (
    SELECT COUNT(*)
    FROM sys.dm_exec_requests r (NOLOCK)
    WHERE r.blocking_session_id <> 0
  ) blockingCount,
  (
    SELECT ISNULL(MAX(r.wait_time / 1000), 0)
    FROM sys.dm_exec_requests r (NOLOCK)
    WHERE r.blocking_session_id <> 0
  ) maxBlockedWaitSec;
