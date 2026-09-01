# PSNA Edmingle secure backend

This server synchronizes the approved PSNA Edmingle batches into the existing Supabase project and serves college-isolated analytics to authenticated teachers.

## Confirmed Edmingle scope

- Institution: `3988`
- Organization header: `ORGID: 5173`
- Course/bundle IDs: `75069`, `75072`, `75113`
- 20 approved production Master Batch IDs are allowlisted in `.env.example`
- Supported analytics: enrolled learners, video/PDF completion, online-test marks, percentage and competition rank
- Request pacing: one call every 3.1 seconds, below Edmingle's 30 calls/minute limit

## Windows setup

Open PowerShell in the extracted project's `backend` folder:

```powershell
cd "C:\Users\LENOVO\Desktop\edmingle_api\PSNA_Teacher_Analytics_Complete\backend"
Copy-Item .env.example .env
notepad .env
npm install
npm test
```

Put the real secrets only in `backend\.env`. Never add them to the portal and never commit that file.

## Database setup

In Supabase Dashboard → SQL Editor, run the complete contents of:

```text
supabase/migrations/202608250001_edmingle_live_psna.sql
```

This migration is additive: it creates only tables and views whose names begin with `edmingle_live_`. It does not alter existing application tables or functions.

Each PSNA teacher must already have an authenticated user and this existing profile mapping:

```sql
update public.profiles
set college_id = '11111111-1111-1111-1111-111111111111',
    role = 'faculty'
where id = 'THE_TEACHERS_AUTH_USER_UUID';
```

Use `hod` instead of `faculty` only for teachers allowed to start synchronization. Repeat the update for every PSNA teacher; do not assign non-PSNA teachers to this college.

## First synchronization

Run the fast roster pass first:

```powershell
npm run sync:psna -- --mode=roster
```

Then run the full progress and assessment pass:

```powershell
npm run sync:psna -- --mode=full
```

The full pass intentionally continues for a while because it paginates all approved batches/classes and waits 3.1 seconds between Edmingle calls. Do not press Enter repeatedly or close the terminal. Progress messages and a final totals object confirm completion.

## Start the API

```powershell
npm run dev
```

Leave that terminal open. `Edmingle backend listening on 8787` means the server is running normally. Test from another PowerShell window:

```powershell
Invoke-RestMethod http://localhost:8787/health
```

## Security model

- Edmingle and Supabase service-role keys are server-only.
- The browser sends an existing Supabase access token.
- The backend verifies the token, reads `profiles.college_id` and `profiles.role`, and rejects non-PSNA users.
- Course, master-batch and class IDs are server-side allowlists; teachers cannot choose another Edmingle scope.
- Raw imported payloads and contact fields are not exposed to authenticated browsers.
- `faculty`, `hod`, and `super_admin` users mapped to PSNA can read all PSNA learner analytics. Only HOD/admin roles can trigger synchronization.

## Routes

- `GET /health`
- `GET /api/my-college/summary`
- `GET /api/my-college/students`
- `GET /api/my-college/content`
- `GET /api/my-college/tests`
- `GET /api/my-college/batches`
- `GET /api/my-college/sync/status`
- `POST /api/my-college/sync` with `{ "mode": "roster" | "full" }`

All analytics routes require `Authorization: Bearer <Supabase access token>`.
