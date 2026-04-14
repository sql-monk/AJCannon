--server,availability groups,hadr
/*
agName string,
agId string,
primaryReplica string,
synchronizationHealth string,
databaseName string,
databaseState string,
synchronizationState string,
isLocal bit,
replicaServerName string,
availabilityMode string,
failoverMode string,
replicaRole string
*/
SELECT
  ag.name agName,
  CONVERT(varchar(36), ag.group_id) agId,
  agl.dns_name primaryReplica,
  ags.synchronization_health_desc synchronizationHealth,
  dbs.database_name databaseName,
  drs.synchronization_state_desc databaseState,
  drs.synchronization_health_desc synchronizationState,
  drs.is_local isLocal,
  ar.replica_server_name replicaServerName,
  ar.availability_mode_desc availabilityMode,
  ar.failover_mode_desc failoverMode,
  ars.role_desc replicaRole
FROM sys.availability_groups ag (NOLOCK)
  JOIN sys.availability_replicas ar (NOLOCK) ON ag.group_id = ar.group_id
  JOIN sys.dm_hadr_availability_replica_states ars (NOLOCK) ON ar.replica_id = ars.replica_id
  LEFT JOIN sys.availability_group_listeners agl (NOLOCK) ON ag.group_id = agl.group_id
  LEFT JOIN sys.availability_databases_cluster dbs (NOLOCK) ON ag.group_id = dbs.group_id
  LEFT JOIN sys.dm_hadr_database_replica_states drs (NOLOCK) ON dbs.group_database_id = drs.group_database_id
    AND ar.replica_id = drs.replica_id
ORDER BY ag.name, ar.replica_server_name, dbs.database_name;
