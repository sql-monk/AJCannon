--object explorer,views
/*
schemaName string,
name string,
object_id int
*/
SELECT s.name schemaName, t.name, t.object_id
FROM sys.views t (NOLOCK)
  JOIN sys.schemas s (NOLOCK) ON t.schema_id = s.schema_id
ORDER BY s.name, t.name;
