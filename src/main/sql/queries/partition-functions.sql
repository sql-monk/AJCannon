--storage,partitioning
/*
name string,
function_id int,
type_desc string,
fanout int,
boundary_value_on_right bit
*/
SELECT pf.name, pf.function_id, pf.type_desc, pf.fanout, pf.boundary_value_on_right
FROM sys.partition_functions pf (NOLOCK)
ORDER BY pf.name;
