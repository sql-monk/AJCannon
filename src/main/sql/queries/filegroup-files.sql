--storage,filegroups,files
/*
file_id int,
name string,
type_desc string,
physical_name string,
size_mb float,
max_size_mb float,
growth_desc string
*/
SELECT
  df.file_id,
  df.name,
  df.type_desc,
  df.physical_name,
  df.size * 8.0 / 1024 size_mb,
  CASE df.max_size
    WHEN -1 THEN -1
    ELSE df.max_size * 8.0 / 1024
  END max_size_mb,
  CASE df.is_percent_growth
    WHEN 1 THEN CAST(df.growth AS VARCHAR) + '%'
    ELSE CAST(df.growth * 8 / 1024 AS VARCHAR) + ' MB'
  END growth_desc
FROM sys.database_files df (NOLOCK)
WHERE df.data_space_id = {{filegroupId}};
