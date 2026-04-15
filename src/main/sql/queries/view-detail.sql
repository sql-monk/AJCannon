--view,detail,info
/*
schemaName string,
viewName string,
rowsCount bigint,
createdDate string,
modifiedDate string,
isUpdatable bit,
checkOption string,
isSchemaBound bit,
withCheckOption bit
*/
SELECT
  s.name                       schemaName,
  v.name                       viewName,
  ISNULL(SUM(p.rows), 0)       rowsCount,
  CONVERT(varchar(30), v.create_date, 120)   createdDate,
  CONVERT(varchar(30), v.modify_date, 120)   modifiedDate,
  ISNULL(OBJECTPROPERTY(v.object_id, 'IsUpdatable'), 0)  isUpdatable,
  CASE WHEN v.with_check_option = 1 THEN 'WITH CHECK OPTION' ELSE '' END  checkOption,
  ISNULL(m.is_schema_bound, 0)  isSchemaBound,
  v.with_check_option           withCheckOption
FROM sys.views v (NOLOCK)
  JOIN sys.schemas s (NOLOCK)              ON v.schema_id = s.schema_id
  LEFT JOIN sys.sql_modules m (NOLOCK)     ON v.object_id = m.object_id
  LEFT JOIN sys.indexes i (NOLOCK)         ON v.object_id = i.object_id AND i.index_id IN (0, 1)
  LEFT JOIN sys.partitions p (NOLOCK)      ON i.object_id = p.object_id AND i.index_id = p.index_id
WHERE s.name = '{{schemaName}}'
  AND v.name = '{{viewName}}'
GROUP BY s.name, v.name, v.create_date, v.modify_date, v.object_id, v.with_check_option, m.is_schema_bound;
