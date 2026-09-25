-- Audit restoration: no existing row is removed or modified until an administrator explicitly restores it.
alter table public.sa_deleted_records add column if not exists restored_at timestamptz;
alter table public.sa_deleted_records add column if not exists restored_by uuid references auth.users(id);

create or replace function public.sa_restore_lesson(p_deleted_id bigint) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare
 v_deleted public.sa_deleted_records%rowtype;
 v_session public.sa_sessions%rowtype;
 v_att public.sa_attendance%rowtype;
 v_evt public.sa_events%rowtype;
 v_element jsonb; v_today date:=(now() at time zone 'Asia/Tashkent')::date;
 v_force_closed boolean;
begin
 if not public.sa_is_admin() then raise exception 'Administrator huquqi kerak'; end if;
 select * into v_deleted from public.sa_deleted_records where id=p_deleted_id for update;
 if not found then raise exception 'O‘chirilgan dars nusxasi topilmadi'; end if;
 if v_deleted.restored_at is not null then raise exception 'Dars allaqachon tiklangan'; end if;
 v_session:=jsonb_populate_record(null::public.sa_sessions,v_deleted.snapshot->'session');
 if v_session.id is null or v_session.group_id is null then raise exception 'Saqlangan dars nusxasi noto‘g‘ri'; end if;
 if exists(select 1 from public.sa_sessions where id=v_session.id) then
   raise exception 'Dars avval tiklangan yoki ayni ID bilan dars mavjud';end if;
 if not exists(select 1 from public.sa_groups where id=v_session.group_id) then
   raise exception 'Avval ushbu darsning guruhini tiklash kerak';end if;
 if exists(select 1 from jsonb_array_elements(v_deleted.snapshot->'attendance') item
   where not exists(select 1 from public.sa_students where id=(item->>'student_id')::uuid)) then
   raise exception 'O‘quvchilar ro‘yxati o‘zgargan. Audit nusxasini administrator tekshirishi kerak';end if;
 if exists(select 1 from jsonb_array_elements(v_deleted.snapshot->'events') item
   where item->>'student_id' is not null and not exists(select 1 from public.sa_students where id=(item->>'student_id')::uuid)) then
   raise exception 'O‘chirilgan tarixda hozir yo‘q o‘quvchi mavjud';end if;
 v_force_closed:=v_session.status='active' and v_session.lesson_date<>v_today;
 insert into public.sa_sessions(id,group_id,lesson_date,planned_start,planned_end,status,opened_by,opened_at,closed_by,closed_at)
 values(v_session.id,v_session.group_id,v_session.lesson_date,v_session.planned_start,v_session.planned_end,
   case when v_force_closed then 'closed' else v_session.status end,
   v_session.opened_by,v_session.opened_at,
   case when v_force_closed then auth.uid() else v_session.closed_by end,
   case when v_force_closed then now() else v_session.closed_at end);
 for v_element in select value from jsonb_array_elements(v_deleted.snapshot->'attendance') loop
   v_att:=jsonb_populate_record(null::public.sa_attendance,v_element);
   insert into public.sa_attendance(session_id,student_id,checked_in,checked_out,late_min,status,note,absence_reason,updated_at)
   values(v_session.id,v_att.student_id,v_att.checked_in,v_att.checked_out,v_att.late_min,
     case when v_force_closed and v_att.checked_in is null then 'absent' else v_att.status end,
     v_att.note,v_att.absence_reason,v_att.updated_at);
 end loop;
 for v_element in select value from jsonb_array_elements(v_deleted.snapshot->'events') loop
   v_evt:=jsonb_populate_record(null::public.sa_events,v_element);
   insert into public.sa_events(session_id,student_id,actor_type,actor_id,action,old_value,new_value,created_at)
   values(v_session.id,v_evt.student_id,v_evt.actor_type,v_evt.actor_id,v_evt.action,v_evt.old_value,v_evt.new_value,v_evt.created_at);
 end loop;
 update public.sa_deleted_records set restored_at=now(),restored_by=auth.uid() where id=p_deleted_id;
 insert into public.sa_events(session_id,actor_type,actor_id,action,new_value)
 values(v_session.id,'admin',auth.uid(),'session_restored',jsonb_build_object('audit_id',p_deleted_id));
 return jsonb_build_object('ok',true,'id',v_session.id,'date',v_session.lesson_date,'restored',true);
exception when unique_violation then raise exception 'Bu guruhda shu vaqtda dars mavjud. Avval uni tekshiring';
end $$;

create or replace function public.sa_remove_group(p_group_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_g public.sa_groups%rowtype; v_sessions integer; v_active integer; v_backups integer;
begin
 if not public.sa_is_admin() then raise exception 'Administrator huquqi kerak'; end if;
 select * into v_g from public.sa_groups where id=p_group_id for update;
 if not found then raise exception 'Guruh topilmadi'; end if;
 select count(*),count(*) filter(where status='active') into v_sessions,v_active
 from public.sa_sessions where group_id=p_group_id;
 if v_active>0 then raise exception 'Avval faol darsni yakunlang yoki dars yozuvini o‘chiring'; end if;
 select count(*) into v_backups from public.sa_deleted_records where group_id=p_group_id and restored_at is null;
 if v_sessions>0 or v_backups>0 then
   update public.sa_groups set archived=true where id=p_group_id;
   insert into public.sa_events(actor_type,actor_id,action,old_value,new_value)
   values('admin',auth.uid(),'group_archived',to_jsonb(v_g),
     jsonb_build_object('lesson_count',v_sessions,'recoverable_deleted_lessons',v_backups));
   return jsonb_build_object('ok',true,'mode','archived','sessions',v_sessions,'backups',v_backups);
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
 if exists(select 1 from public.sa_attendance a join public.sa_sessions se on se.id=a.session_id
  where a.student_id=p_student_id and se.status='active' and a.checked_in is not null and a.checked_out is null)
 then raise exception 'Avval faol darsdagi o‘quvchining KETDIM vaqtini belgilang'; end if;
 select
  exists(select 1 from public.sa_attendance a join public.sa_sessions ss on ss.id=a.session_id
   where a.student_id=p_student_id and (ss.status='closed' or a.checked_in is not null or a.checked_out is not null))
  or exists(select 1 from public.sa_events e where e.student_id=p_student_id)
  or exists(select 1 from public.sa_deleted_records d where d.restored_at is null and exists(
    select 1 from jsonb_array_elements(d.snapshot->'attendance') a
      where a->>'student_id'=p_student_id::text))
 into v_historical;
 if v_historical then
   update public.sa_students set archived=true where id=p_student_id;
   insert into public.sa_events(actor_type,actor_id,action,old_value,new_value)
   values('admin',auth.uid(),'student_archived',to_jsonb(v_st),jsonb_build_object('reason','davomat yoki audit tarixi mavjud'));
   return jsonb_build_object('ok',true,'mode','archived');
 end if;
 delete from public.sa_attendance where student_id=p_student_id;
 delete from public.sa_memberships where student_id=p_student_id;
 insert into public.sa_events(actor_type,actor_id,action,old_value)
 values('admin',auth.uid(),'student_deleted',to_jsonb(v_st));
 delete from public.sa_students where id=p_student_id;
 return jsonb_build_object('ok',true,'mode','deleted');
end $$;
revoke all on function public.sa_restore_lesson(bigint),
 public.sa_remove_group(uuid), public.sa_remove_student(uuid) from public,anon;
grant execute on function public.sa_restore_lesson(bigint),
 public.sa_remove_group(uuid), public.sa_remove_student(uuid) to authenticated;
