--database,extended properties
/*
propertyName string,
propertyValue string
*/
SELECT
  CAST(ep.name AS nvarchar(256)) propertyName,
  CAST(ep.value AS nvarchar(4000)) propertyValue
FROM sys.extended_properties ep (NOLOCK)
WHERE ep.class = 0
  AND ep.major_id = 0
  AND ep.minor_id = 0
ORDER BY ep.name;
