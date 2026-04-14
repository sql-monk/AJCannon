--module,dependencies
/*
referencedSchema string,
referencedEntity string,
referencedType string,
isCallerDependent bit,
isAmbiguous bit
*/
SELECT DISTINCT
  d.referenced_schema_name               referencedSchema,
  d.referenced_entity_name               referencedEntity,
  COALESCE(o2.type_desc, d.referenced_class_desc) referencedType,
  d.is_caller_dependent                  isCallerDependent,
  d.is_ambiguous                         isAmbiguous
FROM sys.dm_sql_referenced_entities(
  '{{schemaName}}.{{objectName}}', 'OBJECT') d
  LEFT JOIN sys.objects o2 (NOLOCK)
    ON o2.name = d.referenced_entity_name
    AND SCHEMA_NAME(o2.schema_id) = COALESCE(d.referenced_schema_name, '{{schemaName}}')
WHERE d.referenced_minor_id = 0
ORDER BY d.referenced_schema_name, d.referenced_entity_name;
