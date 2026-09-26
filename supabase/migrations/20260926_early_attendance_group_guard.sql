-- Never hard-delete groups with early attendance; block archiving while a child is still checked in.
CREATE OR REPLACE FUNCTION public.sa_remove_group(p_group_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public'
AS $$
DECLARE v_g public.sa_groups%rowtype; v_sessions integer; v_active integer;
 v_backups integer; v_pre integer;
BEGIN
 IF NOT public.sa_is_admin() THEN RAISE EXCEPTION 'Administrator huquqi kerak'; END IF;
 SELECT * INTO v_g FROM public.sa_groups WHERE id=p_group_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Guruh topilmadi'; END IF;
 SELECT count(*),count(*) FILTER(WHERE status='active') INTO v_sessions,v_active
 FROM public.sa_sessions WHERE group_id=p_group_id;
 IF v_active>0 THEN RAISE EXCEPTION 'Avval faol darsni yakunlang yoki dars yozuvini o‘chiring'; END IF;
 IF EXISTS(SELECT 1 FROM public.sa_pre_attendance pa WHERE pa.group_id=p_group_id
   AND pa.lesson_date=(now() at time zone 'Asia/Tashkent')::date
   AND pa.checked_out IS NULL
   AND NOT EXISTS(SELECT 1 FROM public.sa_sessions s
     WHERE s.group_id=pa.group_id AND s.lesson_date=pa.lesson_date))
 THEN RAISE EXCEPTION 'Guruhni arxivlashdan oldin kelgan o‘quvchilar KETDIM bosishi kerak'; END IF;
 SELECT count(*) INTO v_backups FROM public.sa_deleted_records
   WHERE group_id=p_group_id AND restored_at IS NULL;
 SELECT count(*) INTO v_pre FROM public.sa_pre_attendance WHERE group_id=p_group_id;
 IF v_sessions>0 OR v_backups>0 OR v_pre>0 THEN
   UPDATE public.sa_groups SET archived=true WHERE id=p_group_id;
   INSERT INTO public.sa_events(actor_type,actor_id,action,old_value,new_value)
   VALUES('admin',auth.uid(),'group_archived',to_jsonb(v_g),
     jsonb_build_object('lesson_count',v_sessions,
       'recoverable_deleted_lessons',v_backups,'early_attendance',v_pre));
   RETURN jsonb_build_object('ok',true,'mode','archived','sessions',v_sessions,
     'backups',v_backups,'early_attendance',v_pre);
 END IF;
 INSERT INTO public.sa_events(actor_type,actor_id,action,old_value)
 VALUES('admin',auth.uid(),'group_deleted',to_jsonb(v_g));
 DELETE FROM public.sa_memberships WHERE group_id=p_group_id;
 DELETE FROM public.sa_groups WHERE id=p_group_id;
 RETURN jsonb_build_object('ok',true,'mode','deleted');
END $$;