--table,columns,detail
/*
columnId int,
name string,
typeName string,
maxLength int,
precision int,
scale int,
isNullable bit,
isIdentity bit,
identitySeed string,
identityIncrement string,
defaultValue string,
isComputed bit,
computedDefinition string,
collation string
*/
SELECT
  c.column_id                columnId,
  c.name,
  tp.name                    typeName,
  c.max_length               maxLength,
  c.precision,
  c.scale,
  c.is_nullable              isNullable,
  c.is_identity              isIdentity,
  CASE WHEN ic.object_id IS NOT NULL
       THEN CAST(ic.seed_value AS varchar(20))
       ELSE NULL END         identitySeed,
  CASE WHEN ic.object_id IS NOT NULL
       THEN CAST(ic.increment_value AS varchar(20))
       ELSE NULL END         identityIncrement,
  dc.definition              defaultValue,
  ISNULL(cc.is_computed, 0)  isComputed,
  cc.definition              computedDefinition,
  c.collation_name           collation
FROM sys.columns c (NOLOCK)
  JOIN sys.types tp (NOLOCK)               ON c.user_type_id = tp.user_type_id
  JOIN sys.tables t (NOLOCK)               ON c.object_id = t.object_id
  JOIN sys.schemas s (NOLOCK)              ON t.schema_id = s.schema_id
  LEFT JOIN sys.identity_columns ic (NOLOCK)
    ON ic.object_id = c.object_id AND ic.column_id = c.column_id
  LEFT JOIN sys.default_constraints dc (NOLOCK)
    ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
  LEFT JOIN sys.computed_columns cc (NOLOCK)
    ON cc.object_id = c.object_id AND cc.column_id = c.column_id
WHERE s.name = '{{schemaName}}'
  AND t.name = '{{tableName}}'
ORDER BY c.column_id;
