-- Performance fix: edmingle_live_student_metrics and edmingle_live_resource_metrics
-- were plain views that recomputed a full aggregate (joins + group by) on every
-- single read. At production data volume this made /summary and /content take
-- 30-60+ seconds and sometimes hit Supabase's statement timeout.
--
-- This migration converts both into materialized views: the aggregate is computed
-- once and stored, so reads are just fast indexed table scans. They're kept fresh
-- by calling public.refresh_edmingle_live_metrics() after each sync (see
-- backend/src/sync/psna.ts), or manually any time from the SQL editor:
--   select public.refresh_edmingle_live_metrics();

begin;

drop view if exists public.edmingle_live_resource_metrics;
drop view if exists public.edmingle_live_student_metrics;

create materialized view public.edmingle_live_student_metrics
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

-- Matches how the app queries this: filtered by college_id, ordered/searched by name.
create unique index edmingle_live_student_metrics_pk
  on public.edmingle_live_student_metrics (college_id, edmingle_user_id);
create index edmingle_live_student_metrics_name_idx
  on public.edmingle_live_student_metrics (college_id, name);

create materialized view public.edmingle_live_resource_metrics
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

create unique index edmingle_live_resource_metrics_pk
  on public.edmingle_live_resource_metrics (college_id, bundle_id, master_batch_id, class_id, resource_id);
create index edmingle_live_resource_metrics_completion_idx
  on public.edmingle_live_resource_metrics (college_id, completion_percentage);

-- Speeds up the refresh itself (it re-scans these base tables every time).
create index if not exists edmingle_live_content_progress_status_idx
  on public.edmingle_live_content_progress (college_id, edmingle_user_id, status);
create index if not exists edmingle_live_test_results_user_idx
  on public.edmingle_live_test_results (college_id, edmingle_user_id, attempts);
create index if not exists edmingle_live_student_batches_user_idx
  on public.edmingle_live_student_batches (college_id, edmingle_user_id);

revoke all on public.edmingle_live_student_metrics, public.edmingle_live_resource_metrics
  from anon, authenticated;
grant select on public.edmingle_live_student_metrics, public.edmingle_live_resource_metrics
  to authenticated;

-- Called by the backend (service role) right after a sync finishes, so the
-- dashboard reflects new data within seconds of a sync completing. Can also
-- be run manually any time: select public.refresh_edmingle_live_metrics();
create or replace function public.refresh_edmingle_live_metrics()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view public.edmingle_live_student_metrics;
  refresh materialized view public.edmingle_live_resource_metrics;
end;
$$;

revoke all on function public.refresh_edmingle_live_metrics() from public;
grant execute on function public.refresh_edmingle_live_metrics() to service_role;

commit;
