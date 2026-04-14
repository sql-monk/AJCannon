--module,parameters,detail
/*
parameterId int,
parameterName string,
typeName string,
maxLength int,
precision int,
scale int,
isOutput bit,
hasDefault bit,
defaultValue string
*/
SELECT
  p.parameter_id             parameterId,
  p.name                     parameterName,
  tp.name                    typeName,
  p.max_length               maxLength,
  p.precision,
  p.scale,
  p.is_output                isOutput,
  p.has_default_value        hasDefault,
  CAST(p.default_value AS varchar(200))  defaultValue
FROM sys.parameters p (NOLOCK)
  JOIN sys.types tp (NOLOCK)    ON p.user_type_id = tp.user_type_id
  JOIN sys.objects o (NOLOCK)   ON p.object_id = o.object_id
  JOIN sys.schemas s (NOLOCK)   ON o.schema_id = s.schema_id
WHERE s.name = '{{schemaName}}'
  AND o.name = '{{objectName}}'
  AND p.parameter_id > 0
ORDER BY p.parameter_id;
