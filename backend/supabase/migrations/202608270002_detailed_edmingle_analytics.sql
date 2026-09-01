-- Detailed learner submissions. Additive: no existing portal data is removed.
alter table public.edmingle_live_content_progress
  add column if not exists activity_kind text not null default 'material',
  add column if not exists outcome text not null default 'unknown';

create table if not exists public.edmingle_live_submissions (
  id bigint generated always as identity primary key,
  college_id uuid not null references public.colleges(id) on delete cascade,
  edmingle_user_id text not null,
  attempt_id text not null,
  assessment_id text not null,
  assessment_name text not null,
  assessment_type text not null,
  class_id text not null,
  master_batch_id text not null,
  course_id text,
  course_name text,
  marks_obtained numeric,
  total_marks numeric,
  percentage numeric,
  passed boolean,
  evaluated boolean not null default false,
  submission_time timestamptz,
  learner_name text,
  email text,
  mobile text,
  raw_data jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  unique (college_id, attempt_id)
);
create index if not exists edmingle_live_submissions_learner_idx on public.edmingle_live_submissions(college_id, edmingle_user_id, submission_time desc);
create index if not exists edmingle_live_submissions_assessment_idx on public.edmingle_live_submissions(college_id, assessment_id, percentage desc);
alter table public.edmingle_live_submissions enable row level security;
drop policy if exists edmingle_live_submissions_college_read on public.edmingle_live_submissions;
create policy edmingle_live_submissions_college_read on public.edmingle_live_submissions for select to authenticated
using (public.can_access_edmingle_analytics_college(college_id));
revoke all on public.edmingle_live_submissions from anon;
grant select on public.edmingle_live_submissions to authenticated;
alter table public.edmingle_live_sync_runs add column if not exists submissions_synced integer not null default 0;
