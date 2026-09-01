begin;

create extension if not exists pgcrypto;

create table if not exists public.colleges (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  edmingle_organization_id text unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.college_aliases (
  id bigint generated always as identity primary key,
  college_id uuid not null references public.colleges(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  unique (college_id, normalized_alias)
);

create table if not exists public.user_college_access (
  user_id uuid not null references auth.users(id) on delete cascade,
  college_id uuid not null references public.colleges(id) on delete cascade,
  role text not null check (role in ('super_admin','college_admin','department_admin','teacher','viewer')),
  active boolean not null default true,
  approved_by uuid references auth.users(id),
  approved_at timestamptz not null default now(),
  primary key (user_id, college_id)
);

create table if not exists public.edmingle_assessment_imports (
  id bigint generated always as identity primary key,
  college_id uuid not null references public.colleges(id) on delete cascade,
  source_key text not null,
  learner_name text not null,
  email text,
  mobile text,
  registration_number text,
  department_text text,
  college_text text,
  batch_name text not null,
  course_name text not null,
  assessment_name text not null,
  assessment_type text,
  evaluation_status text,
  submitted_on_text text,
  marks_obtained numeric,
  total_marks numeric,
  percentage numeric check (percentage is null or percentage between 0 and 100),
  raw_data jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  unique (college_id, source_key)
);

create table if not exists public.edmingle_progress_imports (
  id bigint generated always as identity primary key,
  college_id uuid not null references public.colleges(id) on delete cascade,
  source_key text not null,
  batch_name text not null,
  learner_name text not null,
  email text,
  mobile text,
  registration_number text,
  average_completion numeric check (average_completion is null or average_completion between 0 and 100),
  raw_identity jsonb not null default '[]'::jsonb,
  synced_at timestamptz not null default now(),
  unique (college_id, source_key)
);

create table if not exists public.edmingle_progress_item_imports (
  id bigint generated always as identity primary key,
  college_id uuid not null references public.colleges(id) on delete cascade,
  learner_source_key text not null,
  batch_name text not null,
  content_source_key text not null,
  content_name text not null,
  content_position integer not null,
  status text not null check (status in ('completed','not_attempted','not_completed','unknown')),
  source_value text,
  synced_at timestamptz not null default now(),
  unique (college_id, learner_source_key, content_source_key)
);

create table if not exists public.edmingle_sync_runs (
  id uuid primary key default gen_random_uuid(),
  college_id uuid references public.colleges(id) on delete set null,
  sync_type text not null,
  status text not null check (status in ('running','completed','partial','failed')),
  records_received integer not null default 0,
  records_inserted integer not null default 0,
  records_updated integer not null default 0,
  records_rejected integer not null default 0,
  error_summary text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists assessment_import_college_idx on public.edmingle_assessment_imports(college_id);
create index if not exists assessment_import_department_idx on public.edmingle_assessment_imports(college_id, department_text);
create index if not exists progress_import_college_idx on public.edmingle_progress_imports(college_id);
create index if not exists progress_item_learner_idx on public.edmingle_progress_item_imports(college_id, learner_source_key);
create index if not exists access_user_active_idx on public.user_college_access(user_id) where active;

alter table public.colleges enable row level security;
alter table public.college_aliases enable row level security;
alter table public.user_college_access enable row level security;
alter table public.edmingle_assessment_imports enable row level security;
alter table public.edmingle_progress_imports enable row level security;
alter table public.edmingle_progress_item_imports enable row level security;
alter table public.edmingle_sync_runs enable row level security;

create or replace function public.can_access_college(target_college uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_college_access a
    where a.user_id = auth.uid() and a.college_id = target_college and a.active
  );
$$;

revoke all on function public.can_access_college(uuid) from public;
grant execute on function public.can_access_college(uuid) to authenticated;

create policy "read own college" on public.colleges for select to authenticated
  using (public.can_access_college(id));
create policy "read own aliases" on public.college_aliases for select to authenticated
  using (public.can_access_college(college_id));
create policy "read own access row" on public.user_college_access for select to authenticated
  using (user_id = auth.uid());
create policy "read own assessment data" on public.edmingle_assessment_imports for select to authenticated
  using (public.can_access_college(college_id));
create policy "read own progress summary" on public.edmingle_progress_imports for select to authenticated
  using (public.can_access_college(college_id));
create policy "read own progress items" on public.edmingle_progress_item_imports for select to authenticated
  using (public.can_access_college(college_id));
create policy "read own sync status" on public.edmingle_sync_runs for select to authenticated
  using (college_id is not null and public.can_access_college(college_id));

-- No insert/update/delete policies are granted to authenticated users.
-- Only the server-side service role performs synchronization writes.

commit;
