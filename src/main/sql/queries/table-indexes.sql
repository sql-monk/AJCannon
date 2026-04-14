--object explorer,tables,indexes
/*
name string,
index_id int,
type_desc string
*/
SELECT i.name, i.index_id, i.type_desc
FROM sys.indexes i (NOLOCK)
  JOIN sys.tables t (NOLOCK)  ON i.object_id = t.object_id
  JOIN sys.schemas s (NOLOCK) ON t.schema_id = s.schema_id
WHERE s.name = '{{schemaName}}'
  AND t.name = '{{tableName}}'
ORDER BY i.index_id;
