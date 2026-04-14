--server,memory,buffer pool
/*
databaseName string,
sizeMB int
*/
SELECT TOP 20
  CASE bd.database_id
    WHEN 32767 THEN 'Resource DB'
    ELSE ISNULL(DB_NAME(bd.database_id), 'Other')
  END databaseName,
  COUNT(*) * 8 / 1024 sizeMB
FROM sys.dm_os_buffer_descriptors bd (NOLOCK)
GROUP BY bd.database_id
ORDER BY sizeMB DESC;
