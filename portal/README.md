# PSNA Teacher Analytics Portal

Teacher-facing interface for the secure PSNA Edmingle analytics backend.

## Windows setup

Open PowerShell in the extracted project's `portal` folder:

```powershell
cd "C:\Users\LENOVO\Desktop\edmingle_api\PSNA_Teacher_Analytics_Complete\portal"
Copy-Item .env.example .env.local
notepad .env.local
npm install
npm run dev
```

Fill only these public/runtime values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_EXISTING_ANON_KEY
NEXT_PUBLIC_BACKEND_URL=http://localhost:8787
```

The Edmingle API key and Supabase service-role key must never be placed here. Open the local URL shown by Vite, usually `http://localhost:3000`.

## What teachers see

- PSNA learner count and approved batch count
- Department progress and learners needing attention
- Video/PDF completion by resource
- Online-test marks, percentages and equal-score-aware positions
- Search, department and batch filters
- CSV exports
- Sync status; roster/full sync controls only for HOD/admin roles

The portal never trusts a college ID entered by the browser. The backend derives it from the signed-in user's existing Supabase profile.

## Verify

```powershell
npm run lint
npm test
```

The scripts are Windows-compatible and do not require Bash.
