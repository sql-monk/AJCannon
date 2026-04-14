--object explorer,user types
/*
schemaName string,
name string,
base_type string,
max_length int,
is_nullable bit
*/
SELECT s.name schemaName, t.name, bt.name base_type, t.max_length, t.is_nullable
FROM sys.types t (NOLOCK)
  JOIN sys.schemas s (NOLOCK) ON t.schema_id = s.schema_id
  JOIN sys.types bt (NOLOCK) ON t.system_type_id = bt.user_type_id
WHERE t.is_user_defined = 1
ORDER BY s.name, t.name;
