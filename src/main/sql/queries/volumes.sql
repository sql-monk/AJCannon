--server,volumes,disk space
/*
volumeMountPoint string,
volumeName string,
totalMB decimal,
freeMB decimal,
usedMB decimal
*/
SELECT DISTINCT
  vs.volume_mount_point volumeMountPoint,
  vs.logical_volume_name volumeName,
  CONVERT(decimal(18,2), vs.total_bytes / 1048576.0) totalMB,
  CONVERT(decimal(18,2), vs.available_bytes / 1048576.0) freeMB,
  CONVERT(decimal(18,2), (vs.total_bytes - vs.available_bytes) / 1048576.0) usedMB
FROM sys.master_files mf (NOLOCK)
  CROSS APPLY sys.dm_os_volume_stats(mf.database_id, mf.file_id) vs;
