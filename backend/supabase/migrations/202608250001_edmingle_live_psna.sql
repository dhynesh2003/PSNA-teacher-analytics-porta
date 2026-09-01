begin;

-- Additive module only. Existing colleges, profiles, roles and application tables are not changed.
create extension if not exists pgcrypto;
create table if not exists public.edmingle_live_batches (
  id bigint generated always as identity primary key,
  college_id uuid not null references public.colleges(id) on delete cascade,
  master_batch_id text not null,
  bundle_id text not null,
  bundle_name text not null,
  batch_name text not null,
  department text not null,
  organization_id text not null,
  admitted_students integer not null default 0,
  roster_class_id text not null,
  active boolean not null default true,
  raw_data jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  unique (college_id, master_batch_id)
);

create table if not exists public.edmingle_live_classes (
  id bigint generated always as identity primary key,
  college_id uuid not null references public.colleges(id) on delete cascade,
  class_id text not null,
  master_batch_id text not null,
  bundle_id text not null,
  class_name text not null,
  class_kind text not null check (class_kind in ('material','assessment')),
  reported_students integer not null default 0,
  active boolean not null default true,
  raw_data jsonb not null default '[]'::jsonb,
  synced_at timestamptz not null default now(),
  unique (college_id, class_id)
);

create table if not exists public.edmingle_live_students (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references public.colleges(id) on delete cascade,
  edmingle_user_id text not null,
  name text not null,
  email text,
  mobile text,
  registration_number text,
  active boolean not null default true,
  raw_data jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  unique (college_id, edmingle_user_id)
);

create table if not exists public.edmingle_live_student_batches (
  id bigint generated always as identity primary key,
  college_id uuid not null references public.colleges(id) on delete cascade,
  edmingle_user_id text not null,
  master_batch_id text not null,
  bundle_id text not null,
  department text not null,
  overall_progress numeric check (overall_progress is null or overall_progress between 0 and 100),
  attendance_percent numeric check (attendance_percent is null or attendance_percent between 0 and 100),
  synced_at timestamptz not null default now(),
  unique (college_id, edmingle_user_id, master_batch_id)
);

create table if not exists public.edmingle_live_content_progress (
  id bigint generated always as identity primary key,
  college_id uuid not null references public.colleges(id) on delete cascade,
  edmingle_user_id text not null,
  master_batch_id text not null,
  bundle_id text not null,
  class_id text not null,
  resource_id text not null,
  resource_name text not null,
  resource_type text not null,
  section_id text,
  section_name text,
  activity_kind text not null default 'material',
  outcome text not null default 'unknown',
  status text not null check (status in ('completed','not_completed','not_attempted','unknown')),
  attempts integer not null default 0,
  total_time_seconds numeric,
  raw_data jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  unique (college_id, edmingle_user_id, class_id, resource_id)
);

create table if not exists public.edmingle_live_test_results (
  id bigint generated always as identity primary key,
  college_id uuid not null references public.colleges(id) on delete cascade,
  edmingle_user_id text not null,
  master_batch_id text not null,
  bundle_id text not null,
  class_id text not null,
  resource_id text not null,
  resource_name text not null,
  resource_type text not null,
  marks_obtained numeric,
  total_marks numeric,
  percentage numeric check (percentage is null or percentage between 0 and 100),
  position integer,
  attempts integer not null default 0,
  passed boolean,
  total_time_seconds numeric,
  raw_data jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  unique (college_id, edmingle_user_id, class_id, resource_id)
);

create table if not exists public.edmingle_live_sync_runs (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references public.colleges(id) on delete cascade,
  sync_mode text not null check (sync_mode in ('roster','full')),
  status text not null check (status in ('running','completed','failed')),
  batches_synced integer not null default 0,
  students_synced integer not null default 0,
  content_rows_synced integer not null default 0,
  test_rows_synced integer not null default 0,
  error_summary text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists edmingle_live_batches_college_idx on public.edmingle_live_batches(college_id, active);
create index if not exists edmingle_live_classes_batch_idx on public.edmingle_live_classes(college_id, master_batch_id);
create index if not exists edmingle_live_students_college_idx on public.edmingle_live_students(college_id, name);
create index if not exists edmingle_live_student_batches_user_idx on public.edmingle_live_student_batches(college_id, edmingle_user_id);
create index if not exists edmingle_live_progress_user_idx on public.edmingle_live_content_progress(college_id, edmingle_user_id);
create index if not exists edmingle_live_progress_resource_idx on public.edmingle_live_content_progress(college_id, class_id, resource_id);
create index if not exists edmingle_live_tests_rank_idx on public.edmingle_live_test_results(college_id, class_id, resource_id, position);
create index if not exists edmingle_live_sync_recent_idx on public.edmingle_live_sync_runs(college_id, started_at desc);

create or replace function public.can_access_edmingle_analytics_college(target_college uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.college_id = target_college
      and p.role::text in ('faculty','hod','super_admin')
  );
$$;

revoke all on function public.can_access_edmingle_analytics_college(uuid) from public;
grant execute on function public.can_access_edmingle_analytics_college(uuid) to authenticated;

alter table public.edmingle_live_batches enable row level security;
alter table public.edmingle_live_classes enable row level security;
alter table public.edmingle_live_students enable row level security;
alter table public.edmingle_live_student_batches enable row level security;
alter table public.edmingle_live_content_progress enable row level security;
alter table public.edmingle_live_test_results enable row level security;
alter table public.edmingle_live_sync_runs enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'edmingle_live_batches','edmingle_live_classes','edmingle_live_students',
    'edmingle_live_student_batches','edmingle_live_content_progress',
    'edmingle_live_test_results','edmingle_live_sync_runs'
  ] loop
    execute format('drop policy if exists "teacher reads own college" on public.%I', table_name);
    execute format(
      'create policy "teacher reads own college" on public.%I for select to authenticated using (public.can_access_edmingle_analytics_college(college_id))',
      table_name
    );
  end loop;
end $$;

revoke all on public.edmingle_live_batches, public.edmingle_live_classes,
  public.edmingle_live_students, public.edmingle_live_student_batches,
  public.edmingle_live_content_progress, public.edmingle_live_test_results,
  public.edmingle_live_sync_runs from anon, authenticated;

-- The browser never reads these raw import tables. The server-side service role
-- performs synchronization and returns a deliberately minimized API response.

drop view if exists public.edmingle_live_test_rankings;
drop view if exists public.edmingle_live_resource_metrics;
drop view if exists public.edmingle_live_student_metrics;

create or replace view public.edmingle_live_student_metrics
with (security_invoker = true)
as
with batch_memberships as (
  select
    sb.college_id,
    sb.edmingle_user_id,
    string_agg(distinct sb.master_batch_id, ', ' order by sb.master_batch_id) as master_batch_ids,
    string_agg(distinct sb.department, ', ' order by sb.department) as department,
    string_agg(distinct b.batch_name, ', ' order by b.batch_name) as batch_name,
    round(avg(sb.overall_progress), 2) as average_completion
  from public.edmingle_live_student_batches sb
  join public.edmingle_live_batches b
    on b.college_id = sb.college_id and b.master_batch_id = sb.master_batch_id
  group by sb.college_id, sb.edmingle_user_id
), progress_totals as (
  select
    college_id,
    edmingle_user_id,
    count(*) as content_items,
    count(*) filter (where status = 'completed') as completed_items,
    count(*) filter (where status <> 'completed') as incomplete_items,
    count(*) filter (where status = 'not_attempted') as not_started_items,
    round(100.0 * count(*) filter (where status = 'completed') / nullif(count(*), 0), 2) as verified_completion
  from public.edmingle_live_content_progress
  group by college_id, edmingle_user_id
), assessment_totals as (
  select college_id, edmingle_user_id,
    count(*) as assessments_assigned,
    count(*) filter (where attempts > 0) as assessments_attempted,
    count(*) filter (where attempts > 0 and passed is true) as assessments_passed,
    round(avg(percentage) filter (where attempts > 0 and percentage is not null), 2) as assessment_average
  from public.edmingle_live_test_results
  group by college_id, edmingle_user_id
)
select
  s.college_id,
  s.edmingle_user_id,
  s.name,
  s.registration_number,
  bm.master_batch_ids,
  bm.department,
  bm.batch_name,
  bm.average_completion,
  coalesce(pt.content_items, 0) as content_items,
  coalesce(pt.completed_items, 0) as completed_items,
  coalesce(pt.incomplete_items, 0) as incomplete_items,
  coalesce(pt.not_started_items, 0) as not_started_items,
  pt.verified_completion,
  coalesce(at.assessments_assigned, 0) as assessments_assigned,
  coalesce(at.assessments_attempted, 0) as assessments_attempted,
  coalesce(at.assessments_passed, 0) as assessments_passed,
  at.assessment_average,
  s.synced_at
from public.edmingle_live_students s
join batch_memberships bm
  on bm.college_id = s.college_id and bm.edmingle_user_id = s.edmingle_user_id
left join progress_totals pt
  on pt.college_id = s.college_id and pt.edmingle_user_id = s.edmingle_user_id
left join assessment_totals at
  on at.college_id = s.college_id and at.edmingle_user_id = s.edmingle_user_id
where s.active;

create or replace view public.edmingle_live_resource_metrics
with (security_invoker = true)
as
select
  cp.college_id,
  cp.bundle_id,
  cp.master_batch_id,
  cp.class_id,
  cp.resource_id,
  cp.resource_name,
  cp.resource_type,
  b.department,
  b.batch_name,
  c.class_name,
  count(*) as learner_count,
  count(*) filter (where cp.status = 'completed') as completed_count,
  round(100.0 * count(*) filter (where cp.status = 'completed') / nullif(count(*), 0), 2) as completion_percentage,
  max(cp.synced_at) as synced_at
from public.edmingle_live_content_progress cp
join public.edmingle_live_batches b
  on b.college_id = cp.college_id and b.master_batch_id = cp.master_batch_id
join public.edmingle_live_classes c
  on c.college_id = cp.college_id and c.class_id = cp.class_id
group by cp.college_id, cp.bundle_id, cp.master_batch_id, cp.class_id,
  cp.resource_id, cp.resource_name, cp.resource_type, b.department, b.batch_name, c.class_name;

create or replace view public.edmingle_live_test_rankings
with (security_invoker = true)
as
select
  tr.college_id,
  tr.bundle_id,
  tr.master_batch_id,
  tr.class_id,
  tr.resource_id,
  tr.resource_name,
  tr.edmingle_user_id,
  s.name,
  s.registration_number,
  b.department,
  b.batch_name,
  tr.marks_obtained,
  tr.total_marks,
  tr.percentage,
  tr.position,
  tr.attempts,
  tr.passed,
  tr.synced_at
from public.edmingle_live_test_results tr
join public.edmingle_live_students s
  on s.college_id = tr.college_id and s.edmingle_user_id = tr.edmingle_user_id
join public.edmingle_live_batches b
  on b.college_id = tr.college_id and b.master_batch_id = tr.master_batch_id;

revoke all on public.edmingle_live_student_metrics,
  public.edmingle_live_resource_metrics,
  public.edmingle_live_test_rankings from anon, authenticated;

commit;
