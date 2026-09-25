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
5. In /admin → Guruhlar configure group/teacher/class times. Add students in /admin → O‘quvchilar. Open a class from the dashboard before students check in. End lesson after class, verify missing checkouts, then export /admin → Hisobotlar PDF.

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
