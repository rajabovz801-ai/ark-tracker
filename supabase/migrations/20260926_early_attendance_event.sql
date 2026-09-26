-- One atomic device-authorized check-in or check-out, before or during class.
-- Lock the group so a simultaneous admin open cannot strand a just-recorded arrival.
CREATE OR REPLACE FUNCTION public.sa_kiosk_event_v2(p_token text,p_group_id uuid,p_student_id uuid,p_action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','extensions'
AS $$
DECLARE v_device uuid; v_group public.sa_groups%rowtype;
 v_s public.sa_sessions%rowtype; v_att public.sa_attendance%rowtype;
 v_pre public.sa_pre_attendance%rowtype;
 v_t timestamptz:=clock_timestamp();
 v_today date:=(clock_timestamp() at time zone 'Asia/Tashkent')::date;
 v_late integer; v_session_id uuid;
BEGIN
 IF p_token IS NULL OR length(p_token)<>48 THEN RAISE EXCEPTION 'Terminal tasdiqlanmagan'; END IF;
 SELECT id INTO v_device FROM public.sa_devices
   WHERE token_hash=extensions.digest(p_token,'sha256') AND active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Terminal kodi noto‘g‘ri'; END IF;
 IF (SELECT count(*) FROM public.sa_events WHERE actor_id=v_device
   AND created_at>now()-interval '1 minute')>=40 THEN
   RAISE EXCEPTION 'Juda ko‘p so‘rov. Bir daqiqadan keyin qayta urinib ko‘ring';
 END IF;
 IF p_action NOT IN ('in','out') OR p_action IS NULL THEN RAISE EXCEPTION 'Noto‘g‘ri amal'; END IF;
 SELECT * INTO v_group FROM public.sa_groups WHERE id=p_group_id AND NOT archived FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Guruh topilmadi yoki arxivlangan'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sa_memberships m
   JOIN public.sa_students st ON st.id=m.student_id
   WHERE m.group_id=p_group_id AND m.student_id=p_student_id
     AND m.active AND NOT st.archived) THEN
   RAISE EXCEPTION 'O‘quvchi bu guruhga tegishli emas';
 END IF;
 SELECT * INTO v_s FROM public.sa_sessions
   WHERE group_id=p_group_id AND lesson_date=v_today
   ORDER BY (status='active') DESC,opened_at DESC LIMIT 1 FOR UPDATE;
 IF FOUND AND v_s.status='closed' THEN
   RAISE EXCEPTION 'Bugungi dars yakunlangan. Administratorga murojaat qiling';
 END IF;
 IF v_s.id IS NOT NULL THEN
   v_session_id:=v_s.id;
   INSERT INTO public.sa_attendance(session_id,student_id)
     VALUES(v_session_id,p_student_id) ON CONFLICT DO NOTHING;
   SELECT * INTO v_att FROM public.sa_attendance
     WHERE session_id=v_session_id AND student_id=p_student_id FOR UPDATE;
   IF p_action='in' THEN
     IF v_att.checked_in IS NOT NULL THEN RAISE EXCEPTION 'Kelish avval belgilangan'; END IF;
     v_late:=greatest(0,floor(extract(epoch from (v_t-v_s.planned_start))/60)::integer);
     UPDATE public.sa_attendance SET checked_in=v_t,late_min=v_late,status='present',
       updated_at=now() WHERE session_id=v_session_id AND student_id=p_student_id;
   ELSE
     IF v_att.checked_in IS NULL THEN RAISE EXCEPTION 'Avval KELDIM tugmasini bosing'; END IF;
     IF v_att.checked_out IS NOT NULL THEN RAISE EXCEPTION 'Ketish avval belgilangan'; END IF;
     UPDATE public.sa_attendance SET checked_out=v_t,status='present',updated_at=now()
       WHERE session_id=v_session_id AND student_id=p_student_id;
   END IF;
 ELSE
   SELECT * INTO v_pre FROM public.sa_pre_attendance
     WHERE lesson_date=v_today AND group_id=p_group_id AND student_id=p_student_id FOR UPDATE;
   IF p_action='in' THEN
     IF FOUND THEN RAISE EXCEPTION 'Kelish avval belgilangan'; END IF;
     INSERT INTO public.sa_pre_attendance(lesson_date,group_id,student_id,checked_in)
       VALUES(v_today,p_group_id,p_student_id,v_t);
   ELSE
     IF NOT FOUND THEN RAISE EXCEPTION 'Avval KELDIM tugmasini bosing'; END IF;
     IF v_pre.checked_out IS NOT NULL THEN RAISE EXCEPTION 'Ketish avval belgilangan'; END IF;
     UPDATE public.sa_pre_attendance SET checked_out=v_t,updated_at=now()
       WHERE lesson_date=v_today AND group_id=p_group_id AND student_id=p_student_id;
   END IF;
 END IF;
 INSERT INTO public.sa_events(session_id,student_id,actor_type,actor_id,action,new_value)
   VALUES(v_session_id,p_student_id,'kiosk',v_device,p_action,
     jsonb_build_object('group_id',p_group_id,'lesson_date',v_today,'at',v_t));
 RETURN jsonb_build_object('ok',true,'action',p_action,'timestamp',v_t,
   'before_lesson',v_session_id IS NULL);
END $$;
REVOKE ALL ON FUNCTION public.sa_kiosk_event_v2(text,uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sa_kiosk_event_v2(text,uuid,uuid,text) TO anon,authenticated;