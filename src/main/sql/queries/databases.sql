--object explorer,databases
/*
name string,
database_id int,
state_desc string,
ag_name string,
ag_sync_state string
*/
SELECT
    d.name,
    d.database_id,
    d.state_desc,
    ag.name ag_name,
    drs.synchronization_state_desc ag_sync_state
FROM sys.databases d (NOLOCK)
LEFT JOIN sys.dm_hadr_database_replica_states drs (NOLOCK)
    ON d.database_id = drs.database_id
    AND drs.is_local = 1
LEFT JOIN sys.availability_groups ag (NOLOCK)
    ON drs.group_id = ag.group_id
ORDER BY d.name;
