-- Secure database-owned delivery scheduler: no Vercel environment variable setup required.
-- Secret is generated inside the database, never checked into Git.
create table if not exists public.sa_cron_settings (
  singleton boolean primary key default true check (singleton),
  bearer_token text not null check (length(bearer_token)=64),
  created_at timestamptz not null default now()
);
alter table public.sa_cron_settings enable row level security;
revoke all on public.sa_cron_settings from public,anon,authenticated;
grant select on public.sa_cron_settings to service_role;
insert into public.sa_cron_settings(singleton,bearer_token)
values(true,encode(extensions.gen_random_bytes(32),'hex'))
on conflict(singleton) do nothing;

-- Supabase pg_cron runs UTC. 13:00 = 18:00 in Asia/Tashkent.
-- Three retries in the 18:00 hour help if one group finishes slightly late.
select cron.schedule(
  'sa_teddy_attendance_18_tashkent',
  '0,15,30,45 13 * * *',
  $daily$
  select net.http_get(
    url := 'https://ark-writing-bot-rajabovz801-7955s-projects.vercel.app/api/attendance-daily-report',
    headers := jsonb_build_object(
      'x-ark-attendance-cron',
      (select bearer_token from public.sa_cron_settings where singleton=true)
    ),
    timeout_milliseconds := 20000
  ) as request_id;
  $daily$
);