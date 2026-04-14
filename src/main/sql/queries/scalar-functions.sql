--object explorer,scalar functions
/*
schemaName string,
name string
*/
SELECT s.name schemaName, o.name
FROM sys.objects o (NOLOCK)
  JOIN sys.schemas s (NOLOCK) ON o.schema_id = s.schema_id
WHERE o.type = 'FN'
ORDER BY s.name, o.name;
