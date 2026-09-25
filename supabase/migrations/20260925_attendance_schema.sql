
-- Isolated ARK Smart Attendance schema. No existing Tracker or shared project tables are modified.
create table if not exists public.sa_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Administrator',
  role text not null default 'admin' check (role in ('owner','admin')),
  created_at timestamptz not null default now()
);
create table if not exists public.sa_bootstrap (
  singleton boolean primary key default true check (singleton),
  secret_hash bytea not null,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.sa_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 1 and 80),
  teacher text not null default '',
  starts_at time not null default '09:00',
  ends_at time not null default '10:30',
  late_grace_min integer not null default 5 check (late_grace_min between 0 and 120),
  weekdays smallint[] not null default array[1,3,5]::smallint[],
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.sa_students (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.sa_memberships (
  group_id uuid not null references public.sa_groups(id) on delete restrict,
  student_id uuid not null references public.sa_students(id) on delete restrict,
  active boolean not null default true,
  joined_at timestamptz not null default now(),
  primary key (group_id,student_id)
);
create table if not exists public.sa_sessions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.sa_groups(id) on delete restrict,
  lesson_date date not null,
  planned_start timestamptz not null,
  planned_end timestamptz not null,
  status text not null default 'active' check (status in ('active','closed')),
  opened_by uuid references auth.users(id),
  opened_at timestamptz not null default now(),
  closed_by uuid references auth.users(id),
  closed_at timestamptz,
  unique(group_id,planned_start)
);
create unique index if not exists sa_only_one_active_per_group on public.sa_sessions(group_id) where status='active';
create index if not exists sa_sessions_date_idx on public.sa_sessions(lesson_date);
create table if not exists public.sa_attendance (
  session_id uuid not null references public.sa_sessions(id) on delete restrict,
  student_id uuid not null references public.sa_students(id) on delete restrict,
  checked_in timestamptz,
  checked_out timestamptz,
  late_min integer not null default 0 check (late_min >= 0),
  status text not null default 'pending' check (status in ('pending','present','absent')),
  note text not null default '',
  absence_reason text not null default '',
  updated_at timestamptz not null default now(),
  primary key (session_id,student_id),
  check (checked_out is null or (checked_in is not null and checked_out >= checked_in)),
  check (status != 'absent' or checked_in is null)
);
create index if not exists sa_attendance_student_idx on public.sa_attendance(student_id);
create table if not exists public.sa_devices (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  token_hash bytea not null unique,
  active boolean not null default true,
  last_seen timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create table if not exists public.sa_events (
  id bigint generated always as identity primary key,
  session_id uuid references public.sa_sessions(id) on delete restrict,
  student_id uuid references public.sa_students(id) on delete restrict,
  actor_type text not null check (actor_type in ('admin','kiosk','system')),
  actor_id uuid,
  action text not null,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);
create index if not exists sa_events_session_time on public.sa_events(session_id,created_at desc);
create index if not exists sa_events_actor_time on public.sa_events(actor_id,created_at desc);
-- Private helper always executes with its own owner privileges and a fixed search path.
create or replace function public.sa_is_admin() returns boolean
language sql stable security definer set search_path=pg_catalog,public
as $$ select exists (select 1 from public.sa_admins where user_id=auth.uid()); $$;
revoke all on function public.sa_is_admin() from public;
grant execute on function public.sa_is_admin() to authenticated;
alter table public.sa_admins enable row level security;
alter table public.sa_bootstrap enable row level security;
alter table public.sa_groups enable row level security;
alter table public.sa_students enable row level security;
alter table public.sa_memberships enable row level security;
alter table public.sa_sessions enable row level security;
alter table public.sa_attendance enable row level security;
alter table public.sa_devices enable row level security;
alter table public.sa_events enable row level security;
revoke all on public.sa_admins, public.sa_bootstrap, public.sa_groups, public.sa_students,
public.sa_memberships, public.sa_sessions, public.sa_attendance, public.sa_devices, public.sa_events from anon,authenticated;
grant select on public.sa_admins to authenticated;
grant select,insert,update,delete on public.sa_groups,public.sa_students,public.sa_memberships,public.sa_sessions,public.sa_attendance,public.sa_devices to authenticated;
grant select on public.sa_events to authenticated;
create policy sa_admins_read on public.sa_admins for select to authenticated using (user_id=auth.uid() or public.sa_is_admin());
create policy sa_groups_admin on public.sa_groups for all to authenticated using(public.sa_is_admin()) with check(public.sa_is_admin());
create policy sa_students_admin on public.sa_students for all to authenticated using(public.sa_is_admin()) with check(public.sa_is_admin());
create policy sa_memberships_admin on public.sa_memberships for all to authenticated using(public.sa_is_admin()) with check(public.sa_is_admin());
create policy sa_sessions_admin on public.sa_sessions for all to authenticated using(public.sa_is_admin()) with check(public.sa_is_admin());
create policy sa_attendance_admin on public.sa_attendance for all to authenticated using(public.sa_is_admin()) with check(public.sa_is_admin());
create policy sa_devices_admin on public.sa_devices for all to authenticated using(public.sa_is_admin()) with check(public.sa_is_admin());
create policy sa_events_admin_read on public.sa_events for select to authenticated using(public.sa_is_admin());
insert into public.sa_groups(name,teacher,starts_at,ends_at) values
('IELTS','', '09:00','10:30'),('CEFR','','11:00','12:30'),('404','','14:00','15:30')
on conflict(name) do nothing;
