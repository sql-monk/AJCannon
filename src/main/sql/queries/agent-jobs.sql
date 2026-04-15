--agent,jobs
/*
jobId string,
jobName string,
enabled bit,
description string,
categoryName string,
lastRunDate string,
lastRunOutcome string,
currentlyExecuting int,
nextRunDate string
*/
SELECT
  CONVERT(varchar(36), j.job_id) jobId,
  j.name jobName,
  j.enabled,
  ISNULL(j.description, '') description,
  ISNULL(c.name, '') categoryName,
  CONVERT(varchar(30), ja.last_executed_step_date, 120) lastRunDate,
  CASE jh.run_status
    WHEN 0 THEN 'Failed'
    WHEN 1 THEN 'Succeeded'
    WHEN 2 THEN 'Retry'
    WHEN 3 THEN 'Canceled'
    ELSE 'Unknown'
  END lastRunOutcome,
  CASE WHEN ja.run_requested_date IS NOT NULL
    AND ja.stop_execution_date IS NULL THEN 1 ELSE 0 END currentlyExecuting,
  CONVERT(varchar(30),
    CASE WHEN js.next_run_date > 0
      THEN CONVERT(datetime,
        CONVERT(varchar(8), js.next_run_date) + ' '
        + STUFF(STUFF(RIGHT('000000' + CONVERT(varchar(6), js.next_run_time), 6), 3, 0, ':'), 6, 0, ':'),
        112)
      ELSE NULL
    END,
  120) nextRunDate
FROM msdb.dbo.sysjobs j (NOLOCK)
  LEFT JOIN msdb.dbo.syscategories c (NOLOCK) ON j.category_id = c.category_id
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
  OUTER APPLY (
    SELECT TOP 1 js2.next_run_date, js2.next_run_time
    FROM msdb.dbo.sysjobschedules js2 (NOLOCK)
    WHERE js2.job_id = j.job_id
    ORDER BY js2.next_run_date DESC, js2.next_run_time DESC
  ) js
ORDER BY j.name;
