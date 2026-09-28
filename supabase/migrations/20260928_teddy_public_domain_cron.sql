-- Use the public Teddy production domain; deployment-specific team aliases require
-- Vercel preview-protection authentication and cannot be reached by pg_net.
select cron.schedule(
  'sa_teddy_attendance_18_tashkent',
  '0,15,30,45 13 * * *',
  $daily$
  select net.http_get(
    url := 'https://ark-writing-bot.vercel.app/api/attendance-daily-report',
    headers := jsonb_build_object(
      'x-ark-attendance-cron',
      (select bearer_token from public.sa_cron_settings where singleton=true)
    ),
    timeout_milliseconds := 20000
  ) as request_id;
  $daily$
);