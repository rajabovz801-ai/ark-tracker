# ARK EDUCATION — Smart Attendance MVP 1.0

Production-minded attendance MVP for a supervised Samsung Note 10 terminal and a protected administrator dashboard. The interface is in Uzbek. Next.js 15 App Router, TypeScript, Tailwind, Supabase PostgreSQL/Auth and Vercel.

## What is included
- Secure admin email/password authentication via Supabase Auth and one-time owner activation code. No hard-coded passwords.
- Isolated device-scoped token for the Note 10 kiosk. Students choose group/name, then KELDIM or KETDIM; duplicate submissions prevented at the database transaction boundary.
- Separate class sessions and multiple group memberships. Admin starts and ends lessons, sees automatically refreshed (~5 seconds) attendance, corrects records with audit events, manages groups/students/terminals, and exports PDF.
- At lesson end, missing check-ins become absent; a present student without checkout is NOT absent. Late students are counted within those present.
- PWA manifest and limited service worker for the terminal. Network access is required for attendance writes; no false success while offline.
- Historical daily, group and session print-ready PDF generated server-side (PDFKit).

## Setup / migration
1. The existing GitHub ark-tracker repository is saved in branch backup/tracker-before-smart-attendance-2026-09-25. New version is developed in feature/smart-attendance-mvp; the shared legacy Tracker database table ark_tracker_state and existing backup records are unchanged.
2. Run schema migration supabase/migrations/20260925_attendance_schema.sql followed by supabase/migrations/20260925_attendance_rpcs.sql on the confirmed Supabase project. These migrations have already been applied to the connected project and recorded in Supabase migration history.
3. Use a privileged database console to run SELECT public.sa_initialize_bootstrap(); ONLY ONCE, then record the returned one-time activation code securely. Do not publish the code in GitHub or expose it to students. Log in / sign up at /login, then enter this code in /admin to claim the first administrator account. The activation function only works while there are no administrators.
4. From /admin → Sozlamalar generate a Note 10 terminal token. Copy it only into the /terminal setup screen on the school phone. Keep it private. Revoking a device instantly blocks future requests.
5. In /admin → Guruhlar configure group/teacher/class times. Add students in /admin → O‘quvchilar. Students can check in or check out from the supervised /terminal **before the admin opens class**. Admin opening the lesson imports those original timestamps. KETDIM also works **during an active lesson**; it does not require waiting for scheduled class end. After class, end the session, verify missing checkouts, and export /admin → Hisobotlar PDF.

## Security model
Only the public Supabase project URL and public publishable key are bundled, never the service role key. Client auth sessions use Supabase Auth while server-side admin routes validate access tokens and database row-level security. Kiosk RPCs validate hashed, dedicated and revocable device tokens. Student identity is selected on a supervised terminal, not biometrically verified. Protect physical access to the phone.

## Commands
npm install
npm run dev
npm test
npm run typecheck
npm run lint
npm run build

The Vercel project is ark-tracker, connected to the same GitHub repository. Do not merge into production until the preview build and core check-in/out workflows pass. The PWA should be pinned in Android app settings.

## Known MVP limitations
The admin dashboard polls every five seconds instead of using a persistent Realtime socket. Telegram notifications, advanced timetable automation, face matching, offline attendance and background push notifications are intentionally excluded from MVP 1.0. Full RLS and RPC integration should be smoke-tested with a real administrator and device token before use with learners. Real mobile UI testing is needed on the Note 10 hardware.


## Management update: daily attendance and safe deletion

The administrator interface now provides Add, Edit, Archive and Delete for groups/students. Names, memberships and schedules remain editable on both desktop and mobile. Confirm destructive group/student actions by typing the exact name. Students/groups with historical attendance or recoverable backups are archived instead of permanently removed. Existing memberships remain available upon restoration. A currently checked-in student must be checked out before deletion, and an active group lesson must be closed before group removal.

On the Davomat page, use Dars qo‘shish to create today's or a past lesson, edit its date/time, add an existing group student to its roster, correct individual times, close the session, or delete it after confirmation. Past lessons are created closed with initially absent students until an administrator makes any corrections. On Hisobotlar, choose a date and optionally a group, then delete that day's lesson sessions by typing the date. Each deleted lesson's full roster, arrival/departure timestamps and event log are snapshotted transactionally in the administrator-only deletion audit. Under O‘chirilgan darslar tarixi, choose Tiklash to recover a deleted lesson and its attendance. Restored backups remain visible in the audit log. A restore cannot proceed if the original group or students are missing or an existing lesson conflicts.

### Migration dependency order for a fresh database

Apply manually in the following order; do not assume alphabetical names are chronological:

1. 20260925_attendance_schema.sql
2. 20260925_attendance_rpcs.sql
3. 20260925_attendance_management.sql
4. 20260925_kiosk_archive_filters.sql
5. 20260926_preserve_archive_memberships.sql
6. 20260926_student_active_checkout_guard.sql
7. 20260926_attendance_audit_restore.sql

These changes have already been applied to the connected production Supabase database. All database integration tests use explicit transactions rolled back afterward; existing users and original Tracker data were not deleted. Admin operations remain protected by Supabase Auth and RLS. Kiosk check-in/out continues to require a revocable device token.

## 2026-09-26: Early arrival and early departure

The /terminal screen lists **every non-archived group with its active members**, regardless of class session status. The administrator still activates the supervised phone once with its revocable 48-character device token; students do not need personal accounts. Each name selection and KELDIM/KETDIM is committed to Supabase immediately before a success message appears. The device refreshes the list every ~7 seconds; the administrator dashboard refreshes every ~5 seconds.

Before class opens, arrival/departure timestamps are saved in `sa_pre_attendance` (unique per day/group/student). Both a regular "Darsni ochish" and manually adding today's lesson atomically import the saved check-ins **and check-outs** into ordinary `sa_attendance`. The same terminal uses the normal attendance records for further actions while the lesson is active; KETDIM works at any point during class, not only at the planned end. Repeat KELDIM/KETDIM is rejected. After today's lesson has ended, the terminal shows the group as completed and disables it. Archived groups and students disappear from the terminal. No success message is displayed if the network request fails.

The admin dashboard and live attendance page display pre-class entries as they arrive, and they appear in standard daily reports once the class is opened. Removing groups or students with early attendance archives rather than hard-deleting them; a same-day unfinished early check-in must be checked out before removal. Early events are audited with the group ID even before a session exists. Historical Tracker data remain untouched.

New migrations (apply in this order after earlier migrations):

1. `20260926_early_attendance_table.sql`
2. `20260926_early_attendance_snapshot.sql`
3. `20260926_early_attendance_event.sql`
4. `20260926_early_attendance_open.sql`
5. `20260926_early_attendance_add_lesson.sql`
6. `20260926_early_attendance_student_guard.sql`
7. `20260926_early_attendance_group_guard.sql`

These migrations are additive and have been applied to the connected database. Prior `sa_kiosk_snapshot` and `sa_kiosk_event` still exist for compatibility; the new terminal routes use their `_v2` equivalents.
