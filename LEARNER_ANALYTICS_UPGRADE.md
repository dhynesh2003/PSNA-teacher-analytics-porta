# Learner Analytics Upgrade

## Install the update

1. Back up the currently deployed backend and portal.
2. Replace the deployed `backend` folder with this ZIP's `backend` folder. Preserve your existing backend `.env` values.
3. In Supabase SQL Editor, run these two files in order:
   - `backend/supabase/migrations/202608270001_learner_first_analytics.sql`
   - `backend/supabase/migrations/202608270002_detailed_edmingle_analytics.sql`
4. Redeploy the backend, then replace/redeploy the `portal` folder. Preserve `portal/.env.local` or the equivalent hosting environment variables.
5. Sign in as HOD, college admin, or super admin and choose **Sync & Security → Run full sync**. A roster-only sync will not populate topic/material/assessment detail.

## What the update adds

- All learners are available through server-side pagination (50 per page; 1,270 learners means 26 pages).
- Search and department/batch filters query the full database, not only the loaded page.
- Learner-first rows show assigned, completed, incomplete, completion percentage, assessments attempted/assigned, assessment average, and support status.
- **View details** shows topics/sections, every assigned material, material type, completion status, attempts, returned time, and assessment marks, percentage, pass state, and rank.
- Topic IDs and names are now captured during the full Edmingle sync.
- Complete assessment submission history is stored, including submission date, evaluation status, marks, percentage, pass state and attempt ID.
- Material view timestamps and detailed attempt/part records load securely on demand from the learner drawer.
- Material completion and quiz outcomes remain distinct: Completed/Not Completed versus Passed/Failed/Not Attempted.

## Edmingle data boundary

This build pulls the analytics Edmingle reliably returns through the existing approved endpoints. It does not invent watch duration or last-view timestamps. Detailed material view history can be added later as an on-demand endpoint because fetching it for every learner/material combination during a full sync would create an excessive number of API calls.
