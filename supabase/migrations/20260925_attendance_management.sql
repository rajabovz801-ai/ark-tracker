-- ARK Smart Attendance: safe administration, historical lessons, reversible audit snapshots.
-- Non-destructive migration: existing users, groups, students, lessons and Tracker data are untouched.
create table if not exists public.sa_deleted_records (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('session')),
  target_id uuid not null,
  group_id uuid,
  lesson_date date,
  snapshot jsonb not null,
  deleted_by uuid not null references auth.users(id),
  deleted_at timestamptz not null default now()
);
create index if not exists sa_deleted_records_date on public.sa_deleted_records(lesson_date desc,deleted_at desc);
alter table public.sa_deleted_records enable row level security;
revoke all on public.sa_deleted_records from anon,authenticated;
grant select on public.sa_deleted_records to authenticated;
create policy sa_deleted_records_admin on public.sa_deleted_records for select to authenticated using(public.sa_is_admin());

create or replace function public.sa_remove_group(p_group_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_g public.sa_groups%rowtype; v_sessions integer; v_active integer;
begin
 if not public.sa_is_admin() then raise exception 'Administrator huquqi kerak'; end if;
 select * into v_g from public.sa_groups where id=p_group_id for update;
 if not found then raise exception 'Guruh topilmadi'; end if;
 select count(*),count(*) filter(where status='active') into v_sessions,v_active
 from public.sa_sessions where group_id=p_group_id;
 if v_active>0 then raise exception 'Avval faol darsni yakunlang yoki dars yozuvini o‘chiring'; end if;
 if v_sessions>0 then
   update public.sa_groups set archived=true where id=p_group_id;
   update public.sa_memberships set active=false where group_id=p_group_id;
   insert into public.sa_events(actor_type,actor_id,action,old_value,new_value)
   values('admin',auth.uid(),'group_archived',to_jsonb(v_g),jsonb_build_object('reason','tarixiy darslar mavjud'));
   return jsonb_build_object('ok',true,'mode','archived','sessions',v_sessions);
 end if;
 insert into public.sa_events(actor_type,actor_id,action,old_value)
 values('admin',auth.uid(),'group_deleted',to_jsonb(v_g));
 delete from public.sa_memberships where group_id=p_group_id;
 delete from public.sa_groups where id=p_group_id;
 return jsonb_build_object('ok',true,'mode','deleted');
end $$;

create or replace function public.sa_remove_student(p_student_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_st public.sa_students%rowtype; v_historical boolean;
begin
 if not public.sa_is_admin() then raise exception 'Administrator huquqi kerak'; end if;
 select * into v_st from public.sa_students where id=p_student_id for update;
 if not found then raise exception 'O‘quvchi topilmadi'; end if;
 select exists(select 1 from public.sa_attendance a
    join public.sa_sessions ss on ss.id=a.session_id
    where a.student_id=p_student_id and (ss.status='closed' or a.checked_in is not null or a.checked_out is not null))
 or exists(select 1 from public.sa_events e where e.student_id=p_student_id)
 into v_historical;
 if v_historical then
   update public.sa_students set archived=true where id=p_student_id;
   update public.sa_memberships set active=false where student_id=p_student_id;
   insert into public.sa_events(actor_type,actor_id,action,old_value,new_value)
   values('admin',auth.uid(),'student_archived',to_jsonb(v_st),jsonb_build_object('reason','davomat tarixi mavjud'));
   return jsonb_build_object('ok',true,'mode','archived');
 end if;
 -- A student without historical attendance may still have pending rows in an active lesson.
 delete from public.sa_attendance where student_id=p_student_id;
 delete from public.sa_memberships where student_id=p_student_id;
 insert into public.sa_events(actor_type,actor_id,action,old_value)
 values('admin',auth.uid(),'student_deleted',to_jsonb(v_st));
 delete from public.sa_students where id=p_student_id;
 return jsonb_build_object('ok',true,'mode','deleted');
end $$;

create or replace function public.sa_add_lesson(
 p_group_id uuid,p_date date,p_start time without time zone,p_end time without time zone
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_g public.sa_groups%rowtype; v_s public.sa_sessions%rowtype;
v_today date:=(now() at time zone 'Asia/Tashkent')::date;
v_closed boolean;
begin
 if not public.sa_is_admin() then raise exception 'Administrator huquqi kerak'; end if;
 if p_date is null or p_date<date '2020-01-01' or p_date>v_today then
   raise exception 'Bugungi yoki avvalgi sanani tanlang'; end if;
 if p_start is null or p_end is null then raise exception 'Dars boshlanishi va tugashini tanlang'; end if;
 select * into v_g from public.sa_groups where id=p_group_id and not archived for update;
 if not found then raise exception 'Faol guruh topilmadi'; end if;
 v_closed:=p_date<v_today;
 if not v_closed and exists(select 1 from public.sa_sessions where group_id=p_group_id and status='active') then
   raise exception 'Ushbu guruh uchun faol dars mavjud'; end if;
 insert into public.sa_sessions(group_id,lesson_date,planned_start,planned_end,status,opened_by,closed_by,closed_at)
 values(p_group_id,p_date,(p_date+p_start) at time zone 'Asia/Tashkent',
   ((p_date+case when p_end<=p_start then 1 else 0 end)+p_end) at time zone 'Asia/Tashkent',
   case when v_closed then 'closed' else 'active' end,auth.uid(),
   case when v_closed then auth.uid() else null end,
   case when v_closed then now() else null end)
 returning * into v_s;
 insert into public.sa_attendance(session_id,student_id,status)
 select v_s.id,m.student_id,case when v_closed then 'absent' else 'pending' end
 from public.sa_memberships m join public.sa_students st on st.id=m.student_id
 where m.group_id=p_group_id and m.active and not st.archived;
 insert into public.sa_events(session_id,actor_type,actor_id,action,new_value)
 values(v_s.id,'admin',auth.uid(),'session_added',to_jsonb(v_s));
 return jsonb_build_object('ok',true,'id',v_s.id,'closed',v_closed);
exception when unique_violation then raise exception 'Bu guruhning shu vaqtdagi darsi allaqachon mavjud'; 
end $$;

create or replace function public.sa_edit_lesson(
 p_id uuid,p_date date,p_start time without time zone,p_end time without time zone
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_s public.sa_sessions%rowtype; v_from timestamptz; v_to timestamptz;
v_today date:=(now() at time zone 'Asia/Tashkent')::date;
begin
 if not public.sa_is_admin() then raise exception 'Administrator huquqi kerak'; end if;
 if p_date is null or p_date<date '2020-01-01' or p_date>v_today or p_start is null or p_end is null then
  raise exception 'Sana yoki vaqt noto‘g‘ri'; end if;
 select * into v_s from public.sa_sessions where id=p_id for update;
 if not found then raise exception 'Dars topilmadi'; end if;
 if v_s.status='active' and p_date<>v_today then
   raise exception 'Faol darsning sanasini avval darsni yakunlamasdan o‘zgartirib bo‘lmaydi'; end if;
 if p_date<>v_s.lesson_date and exists(select 1 from public.sa_attendance where session_id=p_id and checked_in is not null) then
   raise exception 'Kelish qayd etilgan darsning sanasini o‘zgartirib bo‘lmaydi'; end if;
 v_from:=(p_date+p_start) at time zone 'Asia/Tashkent';
 v_to:=((p_date+case when p_end<=p_start then 1 else 0 end)+p_end) at time zone 'Asia/Tashkent';
 update public.sa_sessions set lesson_date=p_date,planned_start=v_from,planned_end=v_to where id=p_id;
 update public.sa_attendance set late_min=greatest(0,floor(extract(epoch from (checked_in-v_from))/60)::integer),
 updated_at=now() where session_id=p_id and checked_in is not null;
 insert into public.sa_events(session_id,actor_type,actor_id,action,old_value,new_value)
 values(p_id,'admin',auth.uid(),'session_edited',to_jsonb(v_s),
   (select to_jsonb(s) from public.sa_sessions s where id=p_id));
 return jsonb_build_object('ok',true,'id',p_id);
exception when unique_violation then raise exception 'Bu guruhning shu vaqtdagi darsi allaqachon mavjud';
end $$;

create or replace function public.sa_add_lesson_student(p_session_id uuid,p_student_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_s public.sa_sessions%rowtype;
begin
 if not public.sa_is_admin() then raise exception 'Administrator huquqi kerak'; end if;
 select * into v_s from public.sa_sessions where id=p_session_id for update;
 if not found then raise exception 'Dars topilmadi'; end if;
 if not exists (select 1 from public.sa_memberships m join public.sa_students st on st.id=m.student_id
     where m.group_id=v_s.group_id and m.student_id=p_student_id and m.active and not st.archived) then
   raise exception 'O‘quvchini avval shu guruhga qo‘shing'; end if;
 if exists(select 1 from public.sa_attendance where session_id=p_session_id and student_id=p_student_id) then
   raise exception 'Bu o‘quvchi dars ro‘yxatida bor'; end if;
 insert into public.sa_attendance(session_id,student_id,status)
 values(p_session_id,p_student_id,case when v_s.status='closed' then 'absent' else 'pending' end);
 insert into public.sa_events(session_id,student_id,actor_type,actor_id,action)
 values(p_session_id,p_student_id,'admin',auth.uid(),'session_student_added');
 return jsonb_build_object('ok',true);
end $$;

-- This private helper always runs as part of a transaction initiated by an authenticated admin RPC.
create or replace function public.sa_delete_lesson_private(p_id uuid) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_s public.sa_sessions%rowtype; v_snapshot jsonb;
begin
 select * into v_s from public.sa_sessions where id=p_id for update;
 if not found then raise exception 'Dars topilmadi'; end if;
 select jsonb_build_object(
  'session',to_jsonb(v_s),
  'group',(select to_jsonb(g) from public.sa_groups g where id=v_s.group_id),
  'attendance',coalesce((select jsonb_agg(to_jsonb(a)||jsonb_build_object('student_name',st.name))
    from public.sa_attendance a join public.sa_students st on st.id=a.student_id
    where a.session_id=p_id),'[]'::jsonb),
  'events',coalesce((select jsonb_agg(to_jsonb(e)) from public.sa_events e where e.session_id=p_id),'[]'::jsonb)
 ) into v_snapshot;
 insert into public.sa_deleted_records(kind,target_id,group_id,lesson_date,snapshot,deleted_by)
 values('session',v_s.id,v_s.group_id,v_s.lesson_date,v_snapshot,auth.uid());
 delete from public.sa_events where session_id=p_id;
 delete from public.sa_attendance where session_id=p_id;
 delete from public.sa_sessions where id=p_id;
end $$;
revoke all on function public.sa_delete_lesson_private(uuid) from public,anon,authenticated;

create or replace function public.sa_delete_lesson(p_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_date date;
begin
 if not public.sa_is_admin() then raise exception 'Administrator huquqi kerak'; end if;
 select lesson_date into v_date from public.sa_sessions where id=p_id;
 if v_date is null then raise exception 'Dars topilmadi'; end if;
 perform public.sa_delete_lesson_private(p_id);
 return jsonb_build_object('ok',true,'deleted',1,'date',v_date);
end $$;

create or replace function public.sa_delete_day(p_date date,p_group_id uuid default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_s record; v_count integer:=0;
begin
 if not public.sa_is_admin() then raise exception 'Administrator huquqi kerak'; end if;
 if p_date is null or p_date<date '2020-01-01' or p_date>(now() at time zone 'Asia/Tashkent')::date then
   raise exception 'Sana noto‘g‘ri'; end if;
 if p_group_id is not null and not exists(select 1 from public.sa_groups where id=p_group_id) then
   raise exception 'Guruh topilmadi'; end if;
 for v_s in select id from public.sa_sessions
  where lesson_date=p_date and (p_group_id is null or group_id=p_group_id) order by id for update loop
   perform public.sa_delete_lesson_private(v_s.id);
   v_count:=v_count+1;
 end loop;
 if v_count=0 then raise exception 'Bu sanada o‘chiriladigan dars yo‘q'; end if;
 return jsonb_build_object('ok',true,'deleted',v_count,'date',p_date);
end $$;
revoke all on function public.sa_remove_group(uuid) from public,anon;
revoke all on function public.sa_remove_student(uuid) from public,anon;
revoke all on function public.sa_add_lesson(uuid,date,time without time zone,time without time zone) from public,anon;
revoke all on function public.sa_edit_lesson(uuid,date,time without time zone,time without time zone) from public,anon;
revoke all on function public.sa_add_lesson_student(uuid,uuid) from public,anon;
revoke all on function public.sa_delete_lesson(uuid) from public,anon;
revoke all on function public.sa_delete_day(date,uuid) from public,anon;
grant execute on function public.sa_remove_group(uuid),public.sa_remove_student(uuid),
 public.sa_add_lesson(uuid,date,time without time zone,time without time zone),
 public.sa_edit_lesson(uuid,date,time without time zone,time without time zone),
 public.sa_add_lesson_student(uuid,uuid),public.sa_delete_lesson(uuid),
 public.sa_delete_day(date,uuid) to authenticated;
-- Force deletion to use the transactional audited RPC, not direct PostgREST DELETE.
revoke delete on public.sa_groups,public.sa_students,public.sa_sessions,
 public.sa_attendance,public.sa_memberships from authenticated;
