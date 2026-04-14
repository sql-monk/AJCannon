--storage,partitioning
/*
name string,
data_space_id int,
function_name string
*/
SELECT ps.name, ps.data_space_id, pf.name function_name
FROM sys.partition_schemes ps (NOLOCK)
  JOIN sys.partition_functions pf (NOLOCK) ON ps.function_id = pf.function_id
ORDER BY ps.name;
