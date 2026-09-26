CREATE TABLE IF NOT EXISTS public.sa_pre_attendance (
 lesson_date date NOT NULL,
 group_id uuid NOT NULL REFERENCES public.sa_groups(id) ON DELETE RESTRICT,
 student_id uuid NOT NULL REFERENCES public.sa_students(id) ON DELETE RESTRICT,
 checked_in timestamptz NOT NULL,
 checked_out timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(lesson_date,group_id,student_id),
 CONSTRAINT sa_pre_attendance_time_check CHECK(checked_out IS NULL OR checked_out>=checked_in)
);
CREATE INDEX IF NOT EXISTS sa_pre_attendance_group_date_idx ON public.sa_pre_attendance(group_id,lesson_date);
ALTER TABLE public.sa_pre_attendance ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sa_pre_attendance FROM anon,authenticated;
GRANT SELECT ON public.sa_pre_attendance TO authenticated;
CREATE POLICY sa_pre_attendance_admin_read ON public.sa_pre_attendance FOR SELECT TO authenticated USING(public.sa_is_admin());