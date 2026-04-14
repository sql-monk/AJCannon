--server,databases,disk size
/*
databaseName string,
databaseId int,
stateDesc string,
dataSizeGB decimal,
logSizeGB decimal,
totalSizeGB decimal
*/
SELECT
  d.name databaseName,
  d.database_id databaseId,
  d.state_desc stateDesc,
  CONVERT(decimal(10,2), SUM(CASE WHEN mf.type = 0 THEN mf.size END) * 8.0 / 1048576.0) dataSizeGB,
  CONVERT(decimal(10,2), SUM(CASE WHEN mf.type = 1 THEN mf.size END) * 8.0 / 1048576.0) logSizeGB,
  CONVERT(decimal(10,2), SUM(mf.size) * 8.0 / 1048576.0) totalSizeGB
FROM sys.databases d (NOLOCK)
  JOIN sys.master_files mf (NOLOCK) ON d.database_id = mf.database_id
GROUP BY d.name, d.database_id, d.state_desc
ORDER BY SUM(mf.size) DESC;
