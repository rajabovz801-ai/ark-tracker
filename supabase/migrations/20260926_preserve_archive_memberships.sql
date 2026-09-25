-- Preserve original class memberships when archiving a group or student.
-- Kiosk visibility is separately constrained by archived status.
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

revoke all on function public.sa_remove_group(uuid), public.sa_remove_student(uuid) from public,anon;
grant execute on function public.sa_remove_group(uuid), public.sa_remove_student(uuid) to authenticated;
