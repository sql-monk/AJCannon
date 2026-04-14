--object explorer,procedures
/*
schemaName string,
name string
*/
SELECT s.name schemaName, p.name
FROM sys.procedures p (NOLOCK)
  JOIN sys.schemas s (NOLOCK) ON p.schema_id = s.schema_id
ORDER BY s.name, p.name;
