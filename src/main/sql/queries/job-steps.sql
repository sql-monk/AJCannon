--agent,jobs,steps
/*
stepId int,
stepName string,
subsystem string
*/
SELECT
  js.step_id stepId,
  js.step_name stepName,
  js.subsystem
FROM msdb.dbo.sysjobsteps js (NOLOCK)
WHERE js.job_id = '{{jobId}}'
ORDER BY js.step_id;
