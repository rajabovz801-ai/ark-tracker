-- An early arrival must check out before the student is archived or removed.
CREATE OR REPLACE FUNCTION public.sa_remove_student(p_student_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public'
AS $$
DECLARE v_st public.sa_students%rowtype; v_historical boolean;
BEGIN
 IF NOT public.sa_is_admin() THEN RAISE EXCEPTION 'Administrator huquqi kerak'; END IF;
 SELECT * INTO v_st FROM public.sa_students WHERE id=p_student_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'O‘quvchi topilmadi'; END IF;
 IF EXISTS(SELECT 1 FROM public.sa_attendance a JOIN public.sa_sessions se ON se.id=a.session_id
   WHERE a.student_id=p_student_id AND se.status='active'
     AND a.checked_in IS NOT NULL AND a.checked_out IS NULL)
 OR EXISTS(SELECT 1 FROM public.sa_pre_attendance pa WHERE pa.student_id=p_student_id
     AND pa.lesson_date=(now() at time zone 'Asia/Tashkent')::date
     AND pa.checked_out IS NULL
     AND NOT EXISTS(SELECT 1 FROM public.sa_sessions s
       WHERE s.group_id=pa.group_id AND s.lesson_date=pa.lesson_date))
 THEN RAISE EXCEPTION 'Avval o‘quvchining KETDIM vaqtini belgilang'; END IF;
 SELECT
   EXISTS(SELECT 1 FROM public.sa_attendance a JOIN public.sa_sessions ss ON ss.id=a.session_id
    WHERE a.student_id=p_student_id AND (ss.status='closed' OR a.checked_in IS NOT NULL
      OR a.checked_out IS NOT NULL))
   OR EXISTS(SELECT 1 FROM public.sa_pre_attendance pa WHERE pa.student_id=p_student_id)
   OR EXISTS(SELECT 1 FROM public.sa_events e WHERE e.student_id=p_student_id)
   OR EXISTS(SELECT 1 FROM public.sa_deleted_records d WHERE d.restored_at IS NULL
     AND EXISTS(SELECT 1 FROM jsonb_array_elements(d.snapshot->'attendance') a
       WHERE a->>'student_id'=p_student_id::text))
 INTO v_historical;
 IF v_historical THEN
   UPDATE public.sa_students SET archived=true WHERE id=p_student_id;
   INSERT INTO public.sa_events(actor_type,actor_id,action,old_value,new_value)
    VALUES('admin',auth.uid(),'student_archived',to_jsonb(v_st),
     jsonb_build_object('reason','davomat yoki audit tarixi mavjud'));
   RETURN jsonb_build_object('ok',true,'mode','archived');
 END IF;
 DELETE FROM public.sa_attendance WHERE student_id=p_student_id;
 DELETE FROM public.sa_memberships WHERE student_id=p_student_id;
 INSERT INTO public.sa_events(actor_type,actor_id,action,old_value)
   VALUES('admin',auth.uid(),'student_deleted',to_jsonb(v_st));
 DELETE FROM public.sa_students WHERE id=p_student_id;
 RETURN jsonb_build_object('ok',true,'mode','deleted');
END $$;