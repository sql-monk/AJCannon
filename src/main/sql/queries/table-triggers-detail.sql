--table,triggers,detail
/*
triggerName string,
isEnabled bit,
isInsteadOf bit,
eventType string,
createdDate string,
modifiedDate string
*/
SELECT
  tr.name                    triggerName,
  CASE WHEN tr.is_disabled = 0 THEN 1 ELSE 0 END   isEnabled,
  tr.is_instead_of_trigger   isInsteadOf,
  STUFF((
    SELECT ', ' + te.type_desc
    FROM sys.trigger_events te (NOLOCK)
    WHERE te.object_id = tr.object_id
    FOR XML PATH(''), TYPE
  ).value('.', 'nvarchar(MAX)'), 1, 2, '')  eventType,
  CONVERT(varchar(30), tr.create_date, 120)  createdDate,
  CONVERT(varchar(30), tr.modify_date, 120)  modifiedDate
FROM sys.triggers tr (NOLOCK)
  JOIN sys.tables t (NOLOCK)   ON tr.parent_id = t.object_id
  JOIN sys.schemas s (NOLOCK)  ON t.schema_id = s.schema_id
WHERE s.name = '{{schemaName}}'
  AND t.name = '{{tableName}}'
ORDER BY tr.name;
