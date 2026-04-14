--storage,files
/*
fileId int,
fileName string,
fileType string,
physicalName string,
filegroupName string,
sizeMB decimal,
usedMB decimal,
freeMB decimal
*/
SELECT
  f.file_id fileId,
  f.name fileName,
  f.type_desc fileType,
  f.physical_name physicalName,
  ISNULL(fg.name, 'LOG') filegroupName,
  CONVERT(decimal(18,2), f.size * 8.0 / 1024) sizeMB,
  CONVERT(decimal(18,2), FILEPROPERTY(f.name, 'SpaceUsed') * 8.0 / 1024) usedMB,
  CONVERT(decimal(18,2), (f.size - FILEPROPERTY(f.name, 'SpaceUsed')) * 8.0 / 1024) freeMB
FROM sys.database_files f (NOLOCK)
  LEFT JOIN sys.filegroups fg (NOLOCK) ON f.data_space_id = fg.data_space_id
ORDER BY f.file_id;
