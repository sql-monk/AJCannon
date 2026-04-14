--agent,jobs,running
/*
jobId string,
jobName string,
startTime string,
currentStep int,
currentStepName string
*/
SELECT
  CONVERT(varchar(36), ja.job_id) jobId,
  j.name jobName,
  CONVERT(varchar(30), ja.run_requested_date, 120) startTime,
  ISNULL(ja.last_executed_step_id, 0) currentStep,
  ISNULL(js.step_name, '') currentStepName
FROM msdb.dbo.sysjobactivity ja (NOLOCK)
  JOIN msdb.dbo.sysjobs j (NOLOCK) ON ja.job_id = j.job_id
  LEFT JOIN msdb.dbo.sysjobsteps js (NOLOCK)
    ON ja.job_id = js.job_id AND ja.last_executed_step_id = js.step_id
WHERE ja.session_id = (
  SELECT TOP 1 session_id
  FROM msdb.dbo.syssessions (NOLOCK)
  ORDER BY agent_start_date DESC
)
  AND ja.run_requested_date IS NOT NULL
  AND ja.stop_execution_date IS NULL;
