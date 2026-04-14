--table,detail,info
/*
schemaName string,
tableName string,
rowsCount bigint,
totalSpaceMB decimal,
usedSpaceMB decimal,
createdDate string,
modifiedDate string,
hasIdentity bit,
isReplicated bit,
lockEscalation string
*/
SELECT
  s.name                     schemaName,
  t.name                     tableName,
  SUM(p.rows)                rowsCount,
  CONVERT(decimal(18,2), SUM(au.total_pages) * 8.0 / 1024.0)  totalSpaceMB,
  CONVERT(decimal(18,2), SUM(au.used_pages)  * 8.0 / 1024.0)  usedSpaceMB,
  CONVERT(varchar(30), t.create_date, 120)   createdDate,
  CONVERT(varchar(30), t.modify_date, 120)   modifiedDate,
  OBJECTPROPERTY(t.object_id, 'TableHasIdentity')  hasIdentity,
  t.is_replicated            isReplicated,
  t.lock_escalation_desc     lockEscalation
FROM sys.tables t (NOLOCK)
  JOIN sys.schemas s (NOLOCK)            ON t.schema_id = s.schema_id
  LEFT JOIN sys.partitions p (NOLOCK)    ON t.object_id = p.object_id AND p.index_id IN (0, 1)
  LEFT JOIN sys.allocation_units au (NOLOCK) ON p.partition_id = au.container_id
WHERE s.name = '{{schemaName}}'
  AND t.name = '{{tableName}}'
GROUP BY s.name, t.name, t.create_date, t.modify_date, t.object_id, t.is_replicated, t.lock_escalation_desc;
