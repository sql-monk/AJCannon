--object explorer,functions
/*
schemaName string,
name string,
type_desc string
*/
SELECT s.name schemaName, o.name, o.type_desc
FROM sys.objects o (NOLOCK)
  JOIN sys.schemas s (NOLOCK) ON o.schema_id = s.schema_id
WHERE o.type IN ('FN', 'IF', 'TF')
ORDER BY s.name, o.name;
