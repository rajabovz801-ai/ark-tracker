-- Automatically finalize check-outs when a teacher closes a lesson.
-- Existing student check-out timestamps are never replaced.
create or replace function public.sa_end_session(p_session_id uuid)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public as $fn$
declare
  v_s public.sa_sessions%rowtype;
  v_closed_at timestamptz := clock_timestamp();
  v_present integer;
  v_absent integer;
  v_auto integer := 0;
  v_row public.sa_attendance%rowtype;
begin
  if not public.sa_is_admin() then raise exception 'Ruxsat yo‘q'; end if;
  select * into v_s from public.sa_sessions where id=p_session_id for update;
  if not found then raise exception 'Dars topilmadi'; end if;
  if v_s.status='closed' then
    return jsonb_build_object('ok',true,'already_closed',true,'closed_at',v_s.closed_at);
  end if;
  for v_row in
    select * from public.sa_attendance
    where session_id=p_session_id and checked_in is not null and checked_out is null
    for update
  loop
    update public.sa_attendance
      set checked_out=greatest(v_closed_at,v_row.checked_in),
          status='present',updated_at=v_closed_at
    where session_id=p_session_id and student_id=v_row.student_id;
    insert into public.sa_events(session_id,student_id,actor_type,actor_id,action,old_value,new_value)
    values(p_session_id,v_row.student_id,'system',null,'automatic_checkout',
       jsonb_build_object('checked_out',null),
       jsonb_build_object('checked_out',greatest(v_closed_at,v_row.checked_in),'reason','lesson_closed'));
    v_auto:=v_auto+1;
  end loop;
  update public.sa_attendance
    set status=case when checked_in is null then 'absent' else 'present' end,
        updated_at=v_closed_at
    where session_id=p_session_id;
  update public.sa_sessions
    set status='closed',closed_at=v_closed_at,closed_by=auth.uid()
    where id=p_session_id;
  select count(*) filter(where checked_in is not null),
         count(*) filter(where checked_in is null)
    into v_present,v_absent from public.sa_attendance where session_id=p_session_id;
  insert into public.sa_events(session_id,actor_type,actor_id,action,new_value)
    values(p_session_id,'admin',auth.uid(),'session_closed',
      jsonb_build_object('present',v_present,'absent',v_absent,
                         'automatic_checkouts',v_auto,'closed_at',v_closed_at));
  return jsonb_build_object('ok',true,'present',v_present,'absent',v_absent,
                            'automatic_checkouts',v_auto,'closed_at',v_closed_at);
end $fn$;
revoke all on function public.sa_end_session(uuid) from public,anon;
grant execute on function public.sa_end_session(uuid) to authenticated;