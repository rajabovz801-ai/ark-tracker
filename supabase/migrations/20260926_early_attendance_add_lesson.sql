-- Creating a lesson for today via the management screen also adopts early check-in/out.
CREATE OR REPLACE FUNCTION public.sa_add_lesson(p_group_id uuid,p_date date,p_start time,p_end time)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public'
AS $$
DECLARE v_g public.sa_groups%rowtype; v_s public.sa_sessions%rowtype;
 v_today date:=(now() at time zone 'Asia/Tashkent')::date; v_closed boolean;
BEGIN
 IF NOT public.sa_is_admin() THEN RAISE EXCEPTION 'Administrator huquqi kerak'; END IF;
 IF p_date IS NULL OR p_date<date '2020-01-01' OR p_date>v_today THEN
   RAISE EXCEPTION 'Bugungi yoki avvalgi sanani tanlang'; END IF;
 IF p_start IS NULL OR p_end IS NULL THEN
   RAISE EXCEPTION 'Dars boshlanishi va tugashini tanlang'; END IF;
 SELECT * INTO v_g FROM public.sa_groups WHERE id=p_group_id AND NOT archived FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Faol guruh topilmadi'; END IF;
 v_closed:=p_date<v_today;
 IF NOT v_closed AND EXISTS(SELECT 1 FROM public.sa_sessions
   WHERE group_id=p_group_id AND status='active') THEN
   RAISE EXCEPTION 'Ushbu guruh uchun faol dars mavjud'; END IF;
 INSERT INTO public.sa_sessions(group_id,lesson_date,planned_start,planned_end,status,opened_by,closed_by,closed_at)
 VALUES(p_group_id,p_date,(p_date+p_start) at time zone 'Asia/Tashkent',
   ((p_date+CASE WHEN p_end<=p_start THEN 1 ELSE 0 END)+p_end) at time zone 'Asia/Tashkent',
   CASE WHEN v_closed THEN 'closed' ELSE 'active' END,auth.uid(),
   CASE WHEN v_closed THEN auth.uid() ELSE null END,
   CASE WHEN v_closed THEN now() ELSE null END) RETURNING * INTO v_s;
 INSERT INTO public.sa_attendance(session_id,student_id,checked_in,checked_out,late_min,status)
 SELECT v_s.id,m.student_id,pa.checked_in,pa.checked_out,
   CASE WHEN pa.checked_in IS NULL THEN 0 ELSE
     greatest(0,floor(extract(epoch from (pa.checked_in-v_s.planned_start))/60)::integer) END,
   CASE WHEN v_closed THEN 'absent'
        WHEN pa.checked_in IS NOT NULL THEN 'present' ELSE 'pending' END
 FROM public.sa_memberships m JOIN public.sa_students st ON st.id=m.student_id
 LEFT JOIN public.sa_pre_attendance pa ON pa.group_id=m.group_id
   AND pa.student_id=m.student_id AND pa.lesson_date=p_date AND NOT v_closed
 WHERE m.group_id=p_group_id AND m.active AND NOT st.archived;
 INSERT INTO public.sa_events(session_id,actor_type,actor_id,action,new_value)
 VALUES(v_s.id,'admin',auth.uid(),'session_added',to_jsonb(v_s));
 RETURN jsonb_build_object('ok',true,'id',v_s.id,'closed',v_closed);
EXCEPTION WHEN unique_violation THEN
 RAISE EXCEPTION 'Bu guruhning shu vaqtdagi darsi allaqachon mavjud';
END $$;