--activity,cpu
/*
eventTime datetime,
sqlCpu int,
systemIdle int
*/
SELECT TOP 30
  DATEADD(ms, -1 * (ts_now - rb.timestamp), GETDATE()) eventTime,
  CONVERT(int, record.value('(./Record/SchedulerMonitorEvent/SystemHealth/ProcessUtilization)[1]', 'int')) sqlCpu,
  CONVERT(int, record.value('(./Record/SchedulerMonitorEvent/SystemHealth/SystemIdle)[1]', 'int')) systemIdle
FROM (
  SELECT
    rb.timestamp,
    CONVERT(xml, rb.record) record,
    si.cpu_ticks / (si.cpu_ticks / si.ms_ticks) ts_now
  FROM sys.dm_os_ring_buffers rb (NOLOCK)
    CROSS JOIN sys.dm_os_sys_info si (NOLOCK)
  WHERE rb.ring_buffer_type = N'RING_BUFFER_SCHEDULER_MONITOR'
    AND rb.record LIKE N'%<SystemHealth>%'
) rb
ORDER BY rb.timestamp DESC;
