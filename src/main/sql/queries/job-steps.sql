--agent,jobs,steps
/*
stepId int,
stepName string,
subsystem string,
onSuccessAction string,
onFailAction string,
command string
*/
SELECT
  js.step_id stepId,
  js.step_name stepName,
  js.subsystem,
  CASE js.on_success_action
    WHEN 1 THEN 'Quit with success'
    WHEN 2 THEN 'Quit with failure'
    WHEN 3 THEN 'Go to next step'
    WHEN 4 THEN 'Go to step ' + CONVERT(varchar(10), js.on_success_step_id)
    ELSE 'Unknown'
  END onSuccessAction,
  CASE js.on_fail_action
    WHEN 1 THEN 'Quit with success'
    WHEN 2 THEN 'Quit with failure'
    WHEN 3 THEN 'Go to next step'
    WHEN 4 THEN 'Go to step ' + CONVERT(varchar(10), js.on_fail_step_id)
    ELSE 'Unknown'
  END onFailAction,
  ISNULL(js.command, '') command
FROM msdb.dbo.sysjobsteps js (NOLOCK)
WHERE js.job_id = '{{jobId}}'
ORDER BY js.step_id;
