--query store,options
/*
desired_state_desc string,
actual_state_desc string
*/
SELECT desired_state_desc, actual_state_desc
FROM sys.database_query_store_options (NOLOCK);
