--object explorer,tables,columns
/*
name string,
type_name string,
max_length int,
is_nullable bit
*/
SELECT
  c.name,
  tp.name type_name,
  c.max_length,
  c.is_nullable
FROM sys.columns c (NOLOCK)
  JOIN sys.types tp (NOLOCK)   ON c.user_type_id = tp.user_type_id
  JOIN sys.tables t (NOLOCK)   ON c.object_id = t.object_id
  JOIN sys.schemas s (NOLOCK)  ON t.schema_id = s.schema_id
WHERE s.name = '{{schemaName}}'
  AND t.name = '{{tableName}}'
ORDER BY c.column_id;
