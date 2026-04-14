--server,io,database
/*
databaseName string,
totalReadsMB decimal,
totalWritesMB decimal,
totalIoMB decimal
*/
SELECT
  DB_NAME(vfs.database_id) databaseName,
  CONVERT(decimal(18,2), SUM(vfs.num_of_bytes_read) / 1048576.0) totalReadsMB,
  CONVERT(decimal(18,2), SUM(vfs.num_of_bytes_written) / 1048576.0) totalWritesMB,
  CONVERT(decimal(18,2), (SUM(vfs.num_of_bytes_read) + SUM(vfs.num_of_bytes_written)) / 1048576.0) totalIoMB
FROM sys.dm_io_virtual_file_stats(NULL, NULL) vfs (NOLOCK)
WHERE DB_NAME(vfs.database_id) IS NOT NULL
  AND vfs.database_id > 4
GROUP BY vfs.database_id
ORDER BY totalIoMB DESC;
