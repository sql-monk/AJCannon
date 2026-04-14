--object explorer,synonyms
/*
schemaName string,
name string,
base_object_name string
*/
SELECT s.name schemaName, syn.name, syn.base_object_name
FROM sys.synonyms syn (NOLOCK)
  JOIN sys.schemas s (NOLOCK) ON syn.schema_id = s.schema_id
ORDER BY s.name, syn.name;
