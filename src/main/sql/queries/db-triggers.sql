--object explorer,triggers
/*
name string,
is_disabled bit
*/
SELECT t.name, t.is_disabled
FROM sys.triggers t (NOLOCK)
WHERE t.parent_class = 0
ORDER BY t.name;
