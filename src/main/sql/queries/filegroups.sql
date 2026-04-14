--storage,filegroups
/*
data_space_id int,
name string,
type string,
is_default bit,
is_read_only bit
*/
SELECT fg.data_space_id, fg.name, fg.type, fg.is_default, fg.is_read_only
FROM sys.filegroups fg (NOLOCK)
ORDER BY fg.data_space_id;
