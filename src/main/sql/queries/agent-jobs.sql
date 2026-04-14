--agent,jobs
/*
jobId string,
jobName string,
enabled bit,
description string,
lastRunDate string,
lastRunOutcome string,
currentlyExecuting int
*/
SELECT
  CONVERT(varchar(36), j.job_id) jobId,
  j.name jobName,
  j.enabled,
  ISNULL(j.description, '') description,
  CONVERT(varchar(30), ja.last_executed_step_date, 120) lastRunDate,
  CASE jh.run_status
    WHEN 0 THEN 'Failed'
    WHEN 1 THEN 'Succeeded'
    WHEN 2 THEN 'Retry'
    WHEN 3 THEN 'Canceled'
    ELSE 'Unknown'
  END lastRunOutcome,
  CASE WHEN ja.run_requested_date IS NOT NULL
    AND ja.stop_execution_date IS NULL THEN 1 ELSE 0 END currentlyExecuting
FROM msdb.dbo.sysjobs j (NOLOCK)
  LEFT JOIN msdb.dbo.sysjobactivity ja (NOLOCK) ON j.job_id = ja.job_id
    AND ja.session_id = (
      SELECT TOP 1 session_id
      FROM msdb.dbo.syssessions (NOLOCK)
      ORDER BY agent_start_date DESC
    )
  OUTER APPLY (
    SELECT TOP 1 jh2.run_status
    FROM msdb.dbo.sysjobhistory jh2 (NOLOCK)
    WHERE jh2.job_id = j.job_id AND jh2.step_id = 0
    ORDER BY jh2.run_date DESC, jh2.run_time DESC
  ) jh
ORDER BY j.name;
