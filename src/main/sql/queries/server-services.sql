--server,services
/*
serviceName string,
startupType string,
status string,
lastStartupTime string,
serviceAccount string
*/
SELECT
  ss.servicename serviceName,
  ss.startup_type_desc startupType,
  ss.status_desc status,
  CONVERT(varchar(30), ss.last_startup_time, 120) lastStartupTime,
  ss.service_account serviceAccount
FROM sys.dm_server_services ss (NOLOCK);
