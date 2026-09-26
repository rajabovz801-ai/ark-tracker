-- Admin class start adopts all early arrivals/departures, preserving original device timestamps.
CREATE OR REPLACE FUNCTION public.sa_open_session(p_group_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public'
AS $$
DECLARE v_g public.sa_groups%rowtype; v_s public.sa_sessions%rowtype;
 v_today date:=(now() at time zone 'Asia/Tashkent')::date;
BEGIN
 IF NOT public.sa_is_admin() THEN RAISE EXCEPTION 'Ruxsat yo‘q'; END IF;
 SELECT * INTO v_g FROM public.sa_groups WHERE id=p_group_id AND NOT archived FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Guruh topilmadi'; END IF;
 SELECT * INTO v_s FROM public.sa_sessions WHERE group_id=v_g.id AND status='active' FOR UPDATE;
 IF FOUND THEN
   IF v_s.lesson_date<>v_today THEN
     RAISE EXCEPTION 'Avval oldingi faol darsni yakunlang';
   END IF;
   RETURN jsonb_build_object('ok',true,'id',v_s.id,'already_open',true);
 END IF;
 INSERT INTO public.sa_sessions(group_id,lesson_date,planned_start,planned_end,opened_by)
 VALUES(v_g.id,v_today,(v_today+v_g.starts_at) at time zone 'Asia/Tashkent',
   ((CASE WHEN v_g.ends_at>v_g.starts_at THEN v_today ELSE v_today+1 END)+v_g.ends_at)
   at time zone 'Asia/Tashkent',auth.uid()) RETURNING * INTO v_s;
 INSERT INTO public.sa_attendance(session_id,student_id,checked_in,checked_out,late_min,status)
 SELECT v_s.id,m.student_id,pa.checked_in,pa.checked_out,
   CASE WHEN pa.checked_in IS NULL THEN 0 ELSE
     greatest(0,floor(extract(epoch from (pa.checked_in-v_s.planned_start))/60)::integer) END,
   CASE WHEN pa.checked_in IS NULL THEN 'pending' ELSE 'present' END
 FROM public.sa_memberships m JOIN public.sa_students st ON st.id=m.student_id
 LEFT JOIN public.sa_pre_attendance pa ON pa.group_id=m.group_id
   AND pa.student_id=m.student_id AND pa.lesson_date=v_today
 WHERE m.group_id=v_g.id AND m.active AND NOT st.archived ON CONFLICT DO NOTHING;
 INSERT INTO public.sa_events(session_id,actor_type,actor_id,action)
   VALUES(v_s.id,'admin',auth.uid(),'session_opened');
 RETURN jsonb_build_object('ok',true,'id',v_s.id,'already_open',false);
END $$;