--object explorer,tables,indexes
/*
name string,
index_id int,
type_desc string,
is_unique bit,
sizeMB float,
filter_definition string,
key_columns string,
include_columns string
*/
SELECT
  i.name,
  i.index_id,
  i.type_desc,
  i.is_unique,
  ISNULL((
    SELECT CAST(SUM(ps.used_page_count) * 8.0 / 1024 AS decimal(10,2))
    FROM sys.dm_db_partition_stats ps (NOLOCK)
    WHERE ps.object_id = i.object_id AND ps.index_id = i.index_id
  ), 0) sizeMB,
  i.filter_definition,
  STUFF((
    SELECT ', ' + c.name + CASE WHEN ic2.is_descending_key = 1 THEN ' DESC' ELSE ' ASC' END
    FROM sys.index_columns ic2 (NOLOCK)
      JOIN sys.columns c (NOLOCK) ON c.object_id = ic2.object_id AND c.column_id = ic2.column_id
    WHERE ic2.object_id = i.object_id AND ic2.index_id = i.index_id AND ic2.is_included_column = 0
    ORDER BY ic2.key_ordinal
    FOR XML PATH('')
  ), 1, 2, '') key_columns,
  STUFF((
    SELECT ', ' + c.name
    FROM sys.index_columns ic2 (NOLOCK)
      JOIN sys.columns c (NOLOCK) ON c.object_id = ic2.object_id AND c.column_id = ic2.column_id
    WHERE ic2.object_id = i.object_id AND ic2.index_id = i.index_id AND ic2.is_included_column = 1
    ORDER BY ic2.column_id
    FOR XML PATH('')
  ), 1, 2, '') include_columns
FROM sys.indexes i (NOLOCK)
  JOIN sys.tables t (NOLOCK)  ON i.object_id = t.object_id
  JOIN sys.schemas s (NOLOCK) ON t.schema_id = s.schema_id
WHERE s.name = '{{schemaName}}'
  AND t.name = '{{tableName}}'
  AND i.name IS NOT NULL
ORDER BY i.index_id;
