# PSNA Teacher Analytics Portal — Setup

## Run immediately
1. Open this folder in Visual Studio Code.
2. Run `npm install`.
3. Run `npm run dev`.
4. Open the local address shown in the terminal.
5. Select **Explore demo portal** to review every screen without credentials.

## Enable existing Supabase login
Copy `.env.example` to `.env.local` and fill the public Supabase URL and anon key. Keep service-role and Edmingle API keys server-only. Never prefix secrets with `NEXT_PUBLIC_`.

Run `supabase/migrations/202608210001_psna_analytics.sql` in the existing Supabase SQL editor. Map an approved teacher from `Authentication > Users` into `user_college_access`.

## Confirmed Edmingle sources
- Students: `organization/students`
- Batches: `short/masterbatch`
- Batch students: `masterbatch/{batchId}/students`
- Teaching material progress: `report/class/progress`
- Exercise progress: `reports/classprogress`
- Material views: `materials/{materialId}/viewslist`
- Submission report: `submissions`
- Assessment rank: `reports/resourcestats`

All calls use `apikey` and `ORGID` server-side headers. The browser must never call Edmingle directly.

## Production security gate
1. Rotate any real key that appeared in the exported Postman collection.
2. Confirm the PSNA organization ID.
3. Allow-list only PSNA organization and batch IDs.
4. Confirm RLS denies an unassigned Supabase user.
5. Reconcile live totals with the supplied reports: 988 assessment rows and 63 progress learners.
