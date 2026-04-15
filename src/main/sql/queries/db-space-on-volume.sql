--storage,disk space
/*
databaseName string,
databaseId int,
volumeMountPoint string,
totalSizeMB decimal,
fileCount int
*/
SELECT
  DB_NAME(mf.database_id) databaseName,
  mf.database_id databaseId,
  vs.volume_mount_point volumeMountPoint,
  CONVERT(decimal(18,2), SUM(mf.size * 8.0 / 1024)) totalSizeMB,
  COUNT(*) fileCount
FROM sys.master_files mf (NOLOCK)
  CROSS APPLY sys.dm_os_volume_stats(mf.database_id, mf.file_id) vs
WHERE vs.volume_mount_point = '{{volumeMountPoint}}'
GROUP BY DB_NAME(mf.database_id), mf.database_id, vs.volume_mount_point
ORDER BY totalSizeMB DESC;
