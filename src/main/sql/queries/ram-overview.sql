--server,memory,ram
/*
physicalMemoryGB decimal,
committedMemoryGB decimal,
committedTargetGB decimal,
sqlUsedMemoryGB decimal,
sqlTargetMemoryGB decimal,
sqlMaxMemoryGB decimal,
sqlMinMemoryGB decimal,
pageLifeExpectancy int,
bufferCacheHitRatio decimal,
memoryGrantsPending int
*/
SELECT
  CONVERT(decimal(10,2), si.physical_memory_kb / 1048576.0) physicalMemoryGB,
  CONVERT(decimal(10,2), si.committed_kb / 1048576.0) committedMemoryGB,
  CONVERT(decimal(10,2), si.committed_target_kb / 1048576.0) committedTargetGB,
  (SELECT CONVERT(decimal(10,2), pc.cntr_value / 1048576.0)
    FROM sys.dm_os_performance_counters pc (NOLOCK)
    WHERE pc.object_name LIKE '%Memory Manager%'
      AND pc.counter_name = 'Total Server Memory (KB)') sqlUsedMemoryGB,
  (SELECT CONVERT(decimal(10,2), pc.cntr_value / 1048576.0)
    FROM sys.dm_os_performance_counters pc (NOLOCK)
    WHERE pc.object_name LIKE '%Memory Manager%'
      AND pc.counter_name = 'Target Server Memory (KB)') sqlTargetMemoryGB,
  CONVERT(decimal(10,2), (SELECT CONVERT(bigint, c.value_in_use) FROM sys.configurations c WHERE c.name = 'max server memory (MB)') / 1024.0) sqlMaxMemoryGB,
  CONVERT(decimal(10,2), (SELECT CONVERT(bigint, c.value_in_use) FROM sys.configurations c WHERE c.name = 'min server memory (MB)') / 1024.0) sqlMinMemoryGB,
  (SELECT pc.cntr_value
    FROM sys.dm_os_performance_counters pc (NOLOCK)
    WHERE pc.object_name LIKE '%Buffer Manager%'
      AND pc.counter_name = 'Page life expectancy') pageLifeExpectancy,
  CONVERT(decimal(5,2), (SELECT pc.cntr_value
    FROM sys.dm_os_performance_counters pc (NOLOCK)
    WHERE pc.object_name LIKE '%Buffer Manager%'
      AND pc.counter_name = 'Buffer cache hit ratio')
    * 100.0
    / NULLIF((SELECT pc2.cntr_value
    FROM sys.dm_os_performance_counters pc2 (NOLOCK)
    WHERE pc2.object_name LIKE '%Buffer Manager%'
      AND pc2.counter_name = 'Buffer cache hit ratio base'), 0)) bufferCacheHitRatio,
  (SELECT pc.cntr_value
    FROM sys.dm_os_performance_counters pc (NOLOCK)
    WHERE pc.object_name LIKE '%Memory Manager%'
      AND pc.counter_name = 'Memory Grants Pending') memoryGrantsPending
FROM sys.dm_os_sys_info si (NOLOCK);
