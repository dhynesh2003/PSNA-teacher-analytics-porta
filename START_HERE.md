# Start here — PSNA Teacher Analytics

The portal is complete and uses the existing Supabase project. You do **not** need a second Supabase project.

## Architecture

1. The backend uses the server-only Edmingle API key and `ORGID 5173`.
2. It synchronizes only the 20 allowlisted PSNA Master Batches discovered from course IDs `75069`, `75072`, and `75113`.
3. It writes normalized learner, content-progress, and test-result rows to new `edmingle_live_*` tables.
4. A teacher signs in with the existing Supabase account.
5. The backend verifies `profiles.college_id` and `profiles.role`, then returns only PSNA analytics.

## One-time installation

From this folder in PowerShell:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\INSTALL.ps1
```

Then edit both files created by the installer:

- `backend\.env`: Supabase server credentials plus the Edmingle API key.
- `portal\.env.local`: Supabase URL, anon key, and `http://localhost:8787`.

The service-role key and Edmingle key belong only in `backend\.env`.

## Supabase SQL

Open Supabase Dashboard → SQL Editor and run only:

```text
backend\supabase\migrations\202608250001_edmingle_live_psna.sql
```

This is additive and does not replace existing tables or functions.

For every PSNA teacher, confirm the existing `profiles` record has:

- `college_id = 11111111-1111-1111-1111-111111111111`
- `role = faculty` or `hod`

All such PSNA teachers can see all students in the approved PSNA batches. A `faculty` teacher cannot start a sync; an HOD/admin can.

## Load Edmingle data

```powershell
cd .\backend
npm test
npm run sync:psna -- --mode=roster
npm run sync:psna -- --mode=full
```

The full sync can take a long time. That is expected: it stays below the Edmingle rate limit and paginates all approved classes. Wait for the final totals object.

## Run the application

Terminal 1:

```powershell
cd .\backend
npm run dev
```

Terminal 2:

```powershell
cd .\portal
npm run dev
```

Open the portal URL displayed in Terminal 2 and sign in using an existing PSNA teacher's Supabase email/password.

## Expected result

- Overview totals and department completion
- Student content completion for videos/PDFs/resources
- Online-test marks, percentage, and position
- Search and department/batch filtering
- CSV export
- No non-PSNA users and no unapproved Edmingle batches

The three JSON files under `reference\batch-catalog` are the successful Edmingle batch discovery responses used to validate the 20 production Master Batch IDs.
