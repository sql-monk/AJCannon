--module,info,detail
/*
schemaName string,
objectName string,
objectType string,
createdDate string,
modifiedDate string,
usesAnsiNulls bit,
usesQuotedIdentifier bit,
isSchemaBound bit,
executeAs int
*/
SELECT
  s.name                     schemaName,
  o.name                     objectName,
  o.type_desc                objectType,
  CONVERT(varchar(30), o.create_date, 120)    createdDate,
  CONVERT(varchar(30), o.modify_date, 120)    modifiedDate,
  m.uses_ansi_nulls          usesAnsiNulls,
  m.uses_quoted_identifier   usesQuotedIdentifier,
  m.is_schema_bound          isSchemaBound,
  COALESCE(m.execute_as_principal_id, 0)      executeAs
FROM sys.objects o (NOLOCK)
  JOIN sys.schemas s (NOLOCK)      ON o.schema_id = s.schema_id
  JOIN sys.sql_modules m (NOLOCK)  ON o.object_id = m.object_id
WHERE s.name = '{{schemaName}}'
  AND o.name = '{{objectName}}';
