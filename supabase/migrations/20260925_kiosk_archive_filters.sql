-- Ignore archived groups and learners on the kiosk, including already opened lessons.
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
      where a.session_id=s.id and not st.archived
      and exists(select 1 from public.sa_memberships m
       where m.group_id=g.id and m.student_id=st.id and m.active))
  ) order by g.name),'[]'::jsonb) into v_sessions
  from public.sa_sessions s join public.sa_groups g on g.id=s.group_id
  where s.status='active' and not g.archived and s.lesson_date=(now() at time zone 'Asia/Tashkent')::date;
  return jsonb_build_object('ok',true,'sessions',v_sessions);
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
     not exists(select 1 from public.sa_groups where id=v_s.group_id and not archived) or
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

revoke all on function public.sa_kiosk_snapshot(text) from public; grant execute on function public.sa_kiosk_snapshot(text) to anon,authenticated;
revoke all on function public.sa_kiosk_event(text,uuid,uuid,text) from public; grant execute on function public.sa_kiosk_event(text,uuid,uuid,text) to anon,authenticated;
