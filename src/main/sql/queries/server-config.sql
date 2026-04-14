--server,configuration
/*
name string,
minimum int,
maximum int,
configValue int,
runValue int
*/
SELECT
  c.name,
  c.minimum,
  c.maximum,
  CONVERT(int, c.value) configValue,
  CONVERT(int, c.value_in_use) runValue
FROM sys.configurations c (NOLOCK)
ORDER BY c.name;
