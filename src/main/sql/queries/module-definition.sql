--module,definition,source
/*
definition string
*/
SELECT m.definition
FROM sys.sql_modules m (NOLOCK)
  JOIN sys.objects o (NOLOCK)   ON m.object_id = o.object_id
  JOIN sys.schemas s (NOLOCK)   ON o.schema_id = s.schema_id
WHERE s.name = '{{schemaName}}'
  AND o.name = '{{objectName}}';
