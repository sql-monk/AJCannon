--view,triggers,detail
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
  JOIN sys.views v (NOLOCK)    ON tr.parent_id = v.object_id
  JOIN sys.schemas s (NOLOCK)  ON v.schema_id = s.schema_id
WHERE s.name = '{{schemaName}}'
  AND v.name = '{{viewName}}'
ORDER BY tr.name;
