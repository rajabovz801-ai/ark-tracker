-- Export of the actual deployed ARK Smart Attendance RPC functions.
-- Apply AFTER 20260925_attendance_schema.sql. Existing Tracker tables remain untouched.
CREATE OR REPLACE FUNCTION public.sa_claim_owner(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
declare v_boot public.sa_bootstrap%rowtype;
begin
  if auth.uid() is null then raise exception 'Avval akkauntingizga kiring'; end if;
  select * into v_boot from public.sa_bootstrap where singleton=true for update;
  if not found or v_boot.claimed_at is not null or exists(select 1 from public.sa_admins) then
    raise exception 'Birinchi administrator allaqachon tayinlangan';
  end if;
  if p_code is null or length(p_code) != 48 or extensions.digest(p_code,'sha256') != v_boot.secret_hash then
    raise exception 'Aktivatsiya kodi noto‘g‘ri';
  end if;
  insert into public.sa_admins(user_id,display_name,role) values(auth.uid(),'Rustam Usmonov','owner');
  update public.sa_bootstrap set claimed_at=now() where singleton=true;
  return jsonb_build_object('ok',true,'role','owner');
end $function$


CREATE OR REPLACE FUNCTION public.sa_create_device(p_label text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
declare v_token text; v_id uuid;
begin
  if not public.sa_is_admin() then raise exception 'Ruxsat yo‘q'; end if;
  if length(trim(coalesce(p_label,''))) not between 2 and 80 then raise exception 'Qurilma nomi noto‘g‘ri'; end if;
  v_token := encode(extensions.gen_random_bytes(24),'hex');
  insert into public.sa_devices(label,token_hash,created_by)
  values(trim(p_label),extensions.digest(v_token,'sha256'),auth.uid()) returning id into v_id;
  return jsonb_build_object('id',v_id,'token',v_token,'label',trim(p_label));
end $function$


CREATE OR REPLACE FUNCTION public.sa_end_session(p_session_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare v_s public.sa_sessions%rowtype; v_present int; v_absent int;
begin
  if not public.sa_is_admin() then raise exception 'Ruxsat yo‘q'; end if;
  select * into v_s from public.sa_sessions where id=p_session_id for update;
  if not found then raise exception 'Dars topilmadi'; end if;
  if v_s.status='closed' then raise exception 'Dars allaqachon yakunlangan'; end if;
  update public.sa_attendance set status=case when checked_in is null then 'absent' else 'present' end,
    updated_at=now() where session_id=p_session_id;
  update public.sa_sessions set status='closed',closed_at=now(),closed_by=auth.uid() where id=p_session_id;
  select count(*) filter(where checked_in is not null),count(*) filter(where checked_in is null)
    into v_present,v_absent from public.sa_attendance where session_id=p_session_id;
  insert into public.sa_events(session_id,actor_type,actor_id,action,new_value)
    values(p_session_id,'admin',auth.uid(),'session_closed',
      jsonb_build_object('present',v_present,'absent',v_absent));
  return jsonb_build_object('ok',true,'present',v_present,'absent',v_absent);
end $function$


CREATE OR REPLACE FUNCTION public.sa_initialize_bootstrap()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
declare v_secret text;
begin
  if exists(select 1 from public.sa_admins) or exists(select 1 from public.sa_bootstrap) then
    raise exception 'Attendance setup has already been initialized';
  end if;
  v_secret := encode(extensions.gen_random_bytes(24),'hex');
  insert into public.sa_bootstrap(singleton,secret_hash) values(true,extensions.digest(v_secret,'sha256'));
  return v_secret;
end $function$


CREATE OR REPLACE FUNCTION public.sa_kiosk_event(p_token text, p_session_id uuid, p_student_id uuid, p_action text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
declare v_device uuid; v_s public.sa_sessions%rowtype;
v_a public.sa_attendance%rowtype; v_t timestamptz:=clock_timestamp(); v_late integer;
begin
  if p_token is null or length(p_token)!=48 then raise exception 'Terminal tasdiqlanmagan'; end if;
  select id into v_device from public.sa_devices
    where token_hash=extensions.digest(p_token,'sha256') and active for update;
  if not found then raise exception 'Terminal kodi noto‘g‘ri'; end if;
  if (select count(*) from public.sa_events where actor_id=v_device
    and created_at>now()-interval '1 minute')>=40 then
    raise exception 'Juda ko‘p so‘rov. Bir daqiqadan keyin qayta urinib ko‘ring';
  end if;
  select * into v_s from public.sa_sessions where id=p_session_id for update;
  if not found or v_s.status<>'active' or
     v_s.lesson_date<>(now() at time zone 'Asia/Tashkent')::date then
    raise exception 'Bu dars hozir faol emas';
  end if;
  if not exists(select 1 from public.sa_memberships m join public.sa_students st on st.id=m.student_id
    where m.group_id=v_s.group_id and m.student_id=p_student_id and m.active and not st.archived)
  then raise exception 'O‘quvchi bu guruhga tegishli emas'; end if;
  select * into v_a from public.sa_attendance where session_id=p_session_id
    and student_id=p_student_id for update;
  if not found then raise exception 'O‘quvchi dars ro‘yxatida yo‘q'; end if;
  if p_action='in' then
    if v_a.checked_in is not null then raise exception 'Kelish avval belgilangan'; end if;
    v_late:=greatest(0,floor(extract(epoch from (v_t-v_s.planned_start))/60)::integer);
    update public.sa_attendance set checked_in=v_t,late_min=v_late,status='present',
      updated_at=now() where session_id=p_session_id and student_id=p_student_id;
  elsif p_action='out' then
    if v_a.checked_in is null then raise exception 'Avval KELDIM tugmasini bosing'; end if;
    if v_a.checked_out is not null then raise exception 'Ketish avval belgilangan'; end if;
    update public.sa_attendance set checked_out=v_t,status='present',updated_at=now()
      where session_id=p_session_id and student_id=p_student_id;
  else raise exception 'Noto‘g‘ri amal'; end if;
  insert into public.sa_events(session_id,student_id,actor_type,actor_id,action,new_value)
    values(p_session_id,p_student_id,'kiosk',v_device,p_action,
      jsonb_build_object('at',v_t));
  return jsonb_build_object('ok',true,'action',p_action,'timestamp',v_t);
end $function$


CREATE OR REPLACE FUNCTION public.sa_kiosk_snapshot(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
declare v_device uuid; v_sessions jsonb;
begin
  if p_token is null or length(p_token)!=48 then raise exception 'Terminal tasdiqlanmagan'; end if;
  select id into v_device from public.sa_devices
    where token_hash=extensions.digest(p_token,'sha256') and active;
  if not found then raise exception 'Terminal kodi noto‘g‘ri yoki bekor qilingan'; end if;
  update public.sa_devices set last_seen=now() where id=v_device;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,'group_id',g.id,'name',g.name,'planned_start',s.planned_start,
    'late_grace_min',g.late_grace_min,
    'students',(select coalesce(jsonb_agg(jsonb_build_object(
      'id',st.id,'name',st.name,'checked_in',a.checked_in,
      'checked_out',a.checked_out,'status',a.status) order by st.name),'[]'::jsonb)
      from public.sa_attendance a join public.sa_students st on st.id=a.student_id
      where a.session_id=s.id)
  ) order by g.name),'[]'::jsonb) into v_sessions
  from public.sa_sessions s join public.sa_groups g on g.id=s.group_id
  where s.status='active' and s.lesson_date=(now() at time zone 'Asia/Tashkent')::date;
  return jsonb_build_object('ok',true,'sessions',v_sessions);
end $function$


CREATE OR REPLACE FUNCTION public.sa_manual_mark(p_session_id uuid, p_student_id uuid, p_action text, p_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare v_s public.sa_sessions%rowtype; v_a public.sa_attendance%rowtype;
v_old jsonb; v_new jsonb; v_t timestamptz:=coalesce(p_at,now());
begin
  if not public.sa_is_admin() then raise exception 'Ruxsat yo‘q'; end if;
  select * into v_s from public.sa_sessions where id=p_session_id for update;
  if not found then raise exception 'Dars topilmadi'; end if;
  select * into v_a from public.sa_attendance
    where session_id=p_session_id and student_id=p_student_id for update;
  if not found then raise exception 'O‘quvchi ushbu darsda ro‘yxatda yo‘q'; end if;
  v_old:=to_jsonb(v_a);
  if p_action='in' then
    if v_a.checked_out is not null and v_a.checked_out < v_t then
      raise exception 'Kelish vaqti ketish vaqtidan keyin bo‘lmasin';
    end if;
    update public.sa_attendance set checked_in=v_t,late_min=greatest(0,floor(extract(epoch from (v_t-v_s.planned_start))/60)::integer),
      status='present',updated_at=now() where session_id=p_session_id and student_id=p_student_id;
  elsif p_action='out' then
    if v_a.checked_in is null or v_t<v_a.checked_in then raise exception 'Avval kelishni belgilash kerak'; end if;
    update public.sa_attendance set checked_out=v_t,status='present',updated_at=now()
      where session_id=p_session_id and student_id=p_student_id;
  elsif p_action='absent' then
    update public.sa_attendance set checked_in=null,checked_out=null,late_min=0,status='absent',updated_at=now()
      where session_id=p_session_id and student_id=p_student_id;
  elsif p_action='clear' then
    update public.sa_attendance set checked_in=null,checked_out=null,late_min=0,
      status=case when v_s.status='closed' then 'absent' else 'pending' end,updated_at=now()
      where session_id=p_session_id and student_id=p_student_id;
  elsif p_action='note' then null;
  else raise exception 'Noto‘g‘ri amal'; end if;
  if p_note is not null then
    update public.sa_attendance set note=left(p_note,500),updated_at=now()
    where session_id=p_session_id and student_id=p_student_id;
  end if;
  select to_jsonb(a) into v_new from public.sa_attendance a
    where session_id=p_session_id and student_id=p_student_id;
  insert into public.sa_events(session_id,student_id,actor_type,actor_id,action,old_value,new_value)
    values(p_session_id,p_student_id,'admin',auth.uid(),'manual_'||p_action,v_old,v_new);
  return jsonb_build_object('ok',true,'record',v_new);
end $function$


CREATE OR REPLACE FUNCTION public.sa_open_session(p_group_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare v_g public.sa_groups%rowtype; v_s public.sa_sessions%rowtype;
v_today date := (now() at time zone 'Asia/Tashkent')::date;
begin
  if not public.sa_is_admin() then raise exception 'Ruxsat yo‘q'; end if;
  select * into v_g from public.sa_groups where id=p_group_id and not archived for update;
  if not found then raise exception 'Guruh topilmadi'; end if;
  select * into v_s from public.sa_sessions where group_id=v_g.id and status='active' for update;
  if found then return jsonb_build_object('ok',true,'id',v_s.id,'already_open',true); end if;
  insert into public.sa_sessions(group_id,lesson_date,planned_start,planned_end,opened_by)
  values(v_g.id,v_today,(v_today+v_g.starts_at) at time zone 'Asia/Tashkent',
    ((case when v_g.ends_at>v_g.starts_at then v_today else v_today+1 end)+v_g.ends_at)
    at time zone 'Asia/Tashkent',auth.uid()) returning * into v_s;
  insert into public.sa_attendance(session_id,student_id)
    select v_s.id,m.student_id from public.sa_memberships m
    join public.sa_students st on st.id=m.student_id
    where m.group_id=v_g.id and m.active and not st.archived
    on conflict do nothing;
  insert into public.sa_events(session_id,actor_type,actor_id,action)
    values(v_s.id,'admin',auth.uid(),'session_opened');
  return jsonb_build_object('ok',true,'id',v_s.id,'already_open',false);
end $function$


revoke all on function public.sa_initialize_bootstrap() from public,anon,authenticated;
revoke all on function public.sa_claim_owner(text) from public,anon; grant execute on function public.sa_claim_owner(text) to authenticated;
revoke all on function public.sa_create_device(text) from public,anon; grant execute on function public.sa_create_device(text) to authenticated;
revoke all on function public.sa_open_session(uuid) from public,anon; grant execute on function public.sa_open_session(uuid) to authenticated;
revoke all on function public.sa_end_session(uuid) from public,anon; grant execute on function public.sa_end_session(uuid) to authenticated;
revoke all on function public.sa_manual_mark(uuid,uuid,text,timestamptz,text) from public,anon; grant execute on function public.sa_manual_mark(uuid,uuid,text,timestamptz,text) to authenticated;
revoke all on function public.sa_kiosk_snapshot(text) from public; grant execute on function public.sa_kiosk_snapshot(text) to anon,authenticated;
revoke all on function public.sa_kiosk_event(text,uuid,uuid,text) from public; grant execute on function public.sa_kiosk_event(text,uuid,uuid,text) to anon,authenticated;
