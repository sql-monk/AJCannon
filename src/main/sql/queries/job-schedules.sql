--agent,jobs,schedules
/*
scheduleName string,
freqType string,
freqInterval int,
enabled bit,
nextRunDate string
*/
SELECT
  s.name scheduleName,
  CASE s.freq_type
    WHEN 1 THEN 'Once'
    WHEN 4 THEN 'Daily'
    WHEN 8 THEN 'Weekly'
    WHEN 16 THEN 'Monthly'
    WHEN 32 THEN 'Monthly relative'
    WHEN 64 THEN 'SQL Agent start'
    WHEN 128 THEN 'Idle'
    ELSE 'Unknown'
  END freqType,
  s.freq_interval freqInterval,
  s.enabled,
  CONVERT(varchar(30),
    CASE WHEN js.next_run_date > 0
      THEN CONVERT(datetime,
        CONVERT(varchar(8), js.next_run_date) + ' '
        + STUFF(STUFF(RIGHT('000000' + CONVERT(varchar(6), js.next_run_time), 6), 3, 0, ':'), 6, 0, ':'),
        112)
      ELSE NULL
    END,
  120) nextRunDate
FROM msdb.dbo.sysjobschedules js (NOLOCK)
  JOIN msdb.dbo.sysschedules s (NOLOCK) ON js.schedule_id = s.schedule_id
WHERE js.job_id = '{{jobId}}'
ORDER BY s.name;
