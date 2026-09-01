-- Additive upgrade for learner-first analytics. Safe to run on an existing portal.
alter table public.edmingle_live_content_progress
  add column if not exists section_id text,
  add column if not exists section_name text;

create index if not exists edmingle_live_progress_section_idx
  on public.edmingle_live_content_progress(college_id, edmingle_user_id, section_id);

drop view if exists public.edmingle_live_student_metrics;
create or replace view public.edmingle_live_student_metrics
with (security_invoker = true)
as
with batch_memberships as (
  select sb.college_id, sb.edmingle_user_id,
    string_agg(distinct sb.master_batch_id, ', ' order by sb.master_batch_id) as master_batch_ids,
    string_agg(distinct sb.department, ', ' order by sb.department) as department,
    string_agg(distinct b.batch_name, ', ' order by b.batch_name) as batch_name,
    round(avg(sb.overall_progress), 2) as average_completion
  from public.edmingle_live_student_batches sb
  join public.edmingle_live_batches b on b.college_id=sb.college_id and b.master_batch_id=sb.master_batch_id
  group by sb.college_id, sb.edmingle_user_id
), progress_totals as (
  select college_id, edmingle_user_id, count(*) as content_items,
    count(*) filter (where status='completed') as completed_items,
    count(*) filter (where status<>'completed') as incomplete_items,
    count(*) filter (where status='not_attempted') as not_started_items,
    round(100.0*count(*) filter (where status='completed')/nullif(count(*),0),2) as verified_completion
  from public.edmingle_live_content_progress group by college_id, edmingle_user_id
), assessment_totals as (
  select college_id, edmingle_user_id, count(*) as assessments_assigned,
    count(*) filter (where attempts>0) as assessments_attempted,
    count(*) filter (where attempts>0 and passed is true) as assessments_passed,
    round(avg(percentage) filter (where attempts>0 and percentage is not null),2) as assessment_average
  from public.edmingle_live_test_results group by college_id, edmingle_user_id
)
select s.college_id,s.edmingle_user_id,s.name,s.registration_number,
  bm.master_batch_ids,bm.department,bm.batch_name,bm.average_completion,
  coalesce(pt.content_items,0) as content_items,coalesce(pt.completed_items,0) as completed_items,
  coalesce(pt.incomplete_items,0) as incomplete_items,coalesce(pt.not_started_items,0) as not_started_items,
  pt.verified_completion,coalesce(at.assessments_assigned,0) as assessments_assigned,
  coalesce(at.assessments_attempted,0) as assessments_attempted,
  coalesce(at.assessments_passed,0) as assessments_passed,at.assessment_average,s.synced_at
from public.edmingle_live_students s
join batch_memberships bm on bm.college_id=s.college_id and bm.edmingle_user_id=s.edmingle_user_id
left join progress_totals pt on pt.college_id=s.college_id and pt.edmingle_user_id=s.edmingle_user_id
left join assessment_totals at on at.college_id=s.college_id and at.edmingle_user_id=s.edmingle_user_id
where s.active;

grant select on public.edmingle_live_student_metrics to authenticated;
