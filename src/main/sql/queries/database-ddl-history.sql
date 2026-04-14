--database,ddl,history,events
/*
event_type nvarchar(36),
post_time datetime,
login_name nvarchar(128),
role_name nvarchar(128),
object_type nvarchar(128),
schema_name nvarchar(128),
object_name nvarchar(128),
target_object_name nvarchar(128),
tsql_command nvarchar(max)
*/
SELECT TOP 500
  en.event_type,
  en.post_time,
  en.login_name,
  en.role_name,
  en.object_type,
  en.schema_name,
  en.object_name,
  en.target_object_name,
  en.tsql_command
FROM msdb.dbo.events_notifications en (NOLOCK)
WHERE en.database_name = N'{{dbName}}'
ORDER BY en.post_time DESC;
