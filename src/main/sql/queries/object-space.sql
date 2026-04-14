--storage,objects
/*
schemaName string,
tableName string,
totalSpaceMB decimal,
usedSpaceMB decimal,
rowCount bigint
*/
SELECT
  s.name schemaName,
  t.name tableName,
  CONVERT(decimal(18,2), SUM(a.total_pages) * 8.0 / 1024) totalSpaceMB,
  CONVERT(decimal(18,2), SUM(a.used_pages) * 8.0 / 1024) usedSpaceMB,
  SUM(p.rows) rowCount
FROM sys.tables t (NOLOCK)
  JOIN sys.schemas s (NOLOCK) ON t.schema_id = s.schema_id
  JOIN sys.indexes i (NOLOCK) ON t.object_id = i.object_id
  JOIN sys.partitions p (NOLOCK) ON i.object_id = p.object_id AND i.index_id = p.index_id
  JOIN sys.allocation_units a (NOLOCK) ON p.partition_id = a.container_id
  JOIN sys.filegroups fg (NOLOCK) ON a.data_space_id = fg.data_space_id
  JOIN sys.database_files df (NOLOCK) ON df.data_space_id = fg.data_space_id
WHERE df.file_id = {{fileId}}
GROUP BY s.name, t.name
ORDER BY totalSpaceMB DESC;
