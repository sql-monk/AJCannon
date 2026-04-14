--server,info
/*
productVersion string,
edition string,
cpuCount int,
hyperthreadRatio int,
physicalMemoryMB int,
maxDop int,
costThreshold int,
maxMemoryMB int,
minMemoryMB int,
currentCpuPercent int,
totalServerMemoryMB int,
targetServerMemoryMB int
*/
SELECT
  CONVERT(varchar(30), SERVERPROPERTY('ProductVersion')) productVersion,
  CONVERT(varchar(60), SERVERPROPERTY('Edition')) edition,
  si.cpu_count cpuCount,
  si.hyperthread_ratio hyperthreadRatio,
  CONVERT(int, si.physical_memory_kb / 1024) physicalMemoryMB,
  (SELECT CONVERT(int, c.value_in_use) FROM sys.configurations c WHERE c.name = 'max degree of parallelism') maxDop,
  (SELECT CONVERT(int, c.value_in_use) FROM sys.configurations c WHERE c.name = 'cost threshold for parallelism') costThreshold,
  (SELECT CONVERT(int, c.value_in_use) FROM sys.configurations c WHERE c.name = 'max server memory (MB)') maxMemoryMB,
  (SELECT CONVERT(int, c.value_in_use) FROM sys.configurations c WHERE c.name = 'min server memory (MB)') minMemoryMB,
  (
    SELECT TOP 1
      CONVERT(int, record.value('(./Record/SchedulerMonitorEvent/SystemHealth/ProcessUtilization)[1]', 'int'))
    FROM (
      SELECT CONVERT(xml, rb.record) record
      FROM sys.dm_os_ring_buffers rb (NOLOCK)
      WHERE rb.ring_buffer_type = N'RING_BUFFER_SCHEDULER_MONITOR'
        AND rb.record LIKE N'%<SystemHealth>%'
    ) rb
  ) currentCpuPercent,
  (SELECT CONVERT(int, pc.cntr_value / 1024)
    FROM sys.dm_os_performance_counters pc (NOLOCK)
    WHERE pc.object_name LIKE '%Memory Manager%'
      AND pc.counter_name = 'Total Server Memory (KB)') totalServerMemoryMB,
  (SELECT CONVERT(int, pc.cntr_value / 1024)
    FROM sys.dm_os_performance_counters pc (NOLOCK)
    WHERE pc.object_name LIKE '%Memory Manager%'
      AND pc.counter_name = 'Target Server Memory (KB)') targetServerMemoryMB
FROM sys.dm_os_sys_info si (NOLOCK);
