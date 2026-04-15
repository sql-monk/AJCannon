--view,permissions,security
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
  JOIN sys.views v (NOLOCK)                 ON perm.major_id = v.object_id
  JOIN sys.schemas s (NOLOCK)               ON v.schema_id = s.schema_id
WHERE s.name = '{{schemaName}}'
  AND v.name = '{{viewName}}'
  AND perm.class = 1
ORDER BY dp.name, perm.permission_name;
