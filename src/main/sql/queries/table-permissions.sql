--table,permissions,security
/*
principalName string,
principalType string,
permissionName string,
stateDesc string
*/
SELECT
  dp.name                    principalName,
  dp.type_desc               principalType,
  perm.permission_name       permissionName,
  perm.state_desc            stateDesc
FROM sys.database_permissions perm (NOLOCK)
  JOIN sys.database_principals dp (NOLOCK)  ON perm.grantee_principal_id = dp.principal_id
  JOIN sys.tables t (NOLOCK)                ON perm.major_id = t.object_id
  JOIN sys.schemas s (NOLOCK)               ON t.schema_id = s.schema_id
WHERE s.name = '{{schemaName}}'
  AND t.name = '{{tableName}}'
  AND perm.class = 1
ORDER BY dp.name, perm.permission_name;
