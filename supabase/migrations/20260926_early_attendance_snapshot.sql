-- Return every active group, its members and today's check-in/out, even before an admin opens class.
CREATE OR REPLACE FUNCTION public.sa_kiosk_snapshot_v2(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','extensions'
AS $$
DECLARE v_device uuid; v_today date:=(now() at time zone 'Asia/Tashkent')::date;
 v_groups jsonb;
BEGIN
 IF p_token IS NULL OR length(p_token)<>48 THEN RAISE EXCEPTION 'Terminal tasdiqlanmagan'; END IF;
 SELECT id INTO v_device FROM public.sa_devices
   WHERE token_hash=extensions.digest(p_token,'sha256') AND active;
 IF NOT FOUND THEN RAISE EXCEPTION 'Terminal kodi noto‘g‘ri yoki bekor qilingan'; END IF;
 UPDATE public.sa_devices SET last_seen=now() WHERE id=v_device;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'id',g.id,'group_id',g.id,'name',g.name,
   'session_id',s.id,
   'session_status',coalesce(s.status,'not_started'),
   'planned_start',coalesce(s.planned_start,(v_today+g.starts_at) at time zone 'Asia/Tashkent'),
   'students',(
     SELECT coalesce(jsonb_agg(jsonb_build_object(
       'id',st.id,'name',st.name,
       'checked_in',CASE WHEN s.id IS NOT NULL THEN a.checked_in ELSE pa.checked_in END,
       'checked_out',CASE WHEN s.id IS NOT NULL THEN a.checked_out ELSE pa.checked_out END,
       'status',CASE WHEN s.id IS NOT NULL THEN a.status
           WHEN pa.checked_in IS NOT NULL THEN 'present' ELSE 'pending' END
     ) ORDER BY st.name),'[]'::jsonb)
     FROM public.sa_memberships m
     JOIN public.sa_students st ON st.id=m.student_id
     LEFT JOIN public.sa_attendance a ON a.session_id=s.id AND a.student_id=st.id
     LEFT JOIN public.sa_pre_attendance pa ON pa.group_id=g.id AND pa.student_id=st.id
       AND pa.lesson_date=v_today
     WHERE m.group_id=g.id AND m.active AND NOT st.archived
   )
 ) ORDER BY g.name),'[]'::jsonb) INTO v_groups
 FROM public.sa_groups g
 LEFT JOIN LATERAL (
   SELECT ss.id,ss.status,ss.planned_start FROM public.sa_sessions ss
   WHERE ss.group_id=g.id AND ss.lesson_date=v_today
   ORDER BY (ss.status='active') DESC,ss.opened_at DESC LIMIT 1
 ) s ON TRUE
 WHERE NOT g.archived;
 RETURN jsonb_build_object('ok',true,'sessions',v_groups);
END $$;
REVOKE ALL ON FUNCTION public.sa_kiosk_snapshot_v2(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sa_kiosk_snapshot_v2(text) TO anon,authenticated;