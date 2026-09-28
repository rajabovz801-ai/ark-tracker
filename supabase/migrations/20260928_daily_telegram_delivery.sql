-- Daily report delivery receipts; accessible only from privileged server-side service-role clients.
create table if not exists public.sa_report_deliveries (
  report_date date not null,
  admin_telegram_id bigint not null,
  delivered_at timestamptz not null default now(),
  primary key(report_date,admin_telegram_id)
);
alter table public.sa_report_deliveries enable row level security;
revoke all on public.sa_report_deliveries from anon,authenticated;
grant select,insert,update on public.sa_report_deliveries to service_role;