--backup,recovery
/*
backup_type char,
backup_type_desc string,
backup_start_date datetime,
backup_finish_date datetime,
backup_size_mb float,
compressed_size_mb float,
server_name string,
database_name string,
user_name string,
is_copy_only bit
*/
SELECT TOP 100
  bs.type backup_type,
  CASE bs.type
    WHEN 'D' THEN 'Full'
    WHEN 'I' THEN 'Differential'
    WHEN 'L' THEN 'Log'
    ELSE bs.type
  END backup_type_desc,
  bs.backup_start_date,
  bs.backup_finish_date,
  bs.backup_size / 1048576.0 backup_size_mb,
  bs.compressed_backup_size / 1048576.0 compressed_size_mb,
  bs.server_name,
  bs.database_name,
  bs.user_name,
  bs.is_copy_only
FROM msdb.dbo.backupset bs (NOLOCK)
WHERE bs.database_name = '{{dbName}}'
ORDER BY bs.backup_start_date DESC;
