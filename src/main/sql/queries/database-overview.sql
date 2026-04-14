--server,databases,overview
/*
databaseName string,
databaseId int,
stateDesc string,
dataSizeMB decimal,
logSizeMB decimal,
logFreeSpaceMB decimal,
dataFileCount int,
logFileCount int,
logReuseWaitDesc string,
agName string,
agSyncState string,
dbOwner string
*/
SELECT
	d.name databaseName,
	d.database_id databaseId,
	d.state_desc stateDesc,
	CONVERT(DECIMAL(12, 2), SUM(CASE WHEN mf.type = 0 THEN mf.size END) * 8.0 / 1024.0) dataSizeMB,
	CONVERT(DECIMAL(12, 2), SUM(CASE WHEN mf.type = 1 THEN mf.size END) * 8.0 / 1024.0) logSizeMB,
	CONVERT(
		DECIMAL(12, 2),
		SUM(CASE WHEN mf.type = 1 THEN mf.size END) * 8.0 / 1024.0
		- ISNULL(SUM(CASE WHEN mf.type = 1 THEN FILEPROPERTY(mf.name, 'SpaceUsed') END) * 8.0 / 1024.0, 0)
	) logFreeSpaceMB,
	SUM(CASE WHEN mf.type = 0 THEN 1 ELSE 0 END) dataFileCount,
	SUM(CASE WHEN mf.type = 1 THEN 1 ELSE 0 END) logFileCount,
	d.log_reuse_wait_desc logReuseWaitDesc,
	'' agName,
	drs.synchronization_state_desc agSyncState,
	SUSER_SNAME(d.owner_sid) dbOwner
FROM sys.databases d(NOLOCK)
	JOIN sys.master_files mf(NOLOCK)ON d.database_id = mf.database_id
	LEFT JOIN sys.dm_hadr_database_replica_states drs(NOLOCK)ON d.database_id = drs.database_id
GROUP BY d.name,
	d.database_id,
	d.state_desc,
	d.log_reuse_wait_desc,
	drs.synchronization_state_desc,
	d.owner_sid
ORDER BY d.name;
