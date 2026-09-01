begin;

create table if not exists public.edmingle_student_roster (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references public.colleges(id) on delete cascade,
  edmingle_student_id text,
  registration_number text,
  full_name text not null,
  email text,
  mobile text,
  department text,
  match_status text not null default 'pending'
    check (match_status in ('pending','matched','not_found','ambiguous','manual_review')),
  match_method text check (match_method is null or match_method in ('exact_email','exact_mobile','exact_registration','manual')),
  source text not null default 'official_roster',
  active boolean not null default true,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists edmingle_roster_college_student_uidx
  on public.edmingle_student_roster(college_id, edmingle_student_id)
  where edmingle_student_id is not null;
create unique index if not exists edmingle_roster_college_email_uidx
  on public.edmingle_student_roster(college_id, lower(email))
  where email is not null and email <> '';
create index if not exists edmingle_roster_college_active_idx
  on public.edmingle_student_roster(college_id) where active;

alter table public.edmingle_student_roster enable row level security;
drop policy if exists "read verified college roster" on public.edmingle_student_roster;
create policy "read verified college roster"
  on public.edmingle_student_roster for select to authenticated
  using (public.can_access_edmingle_college(college_id));

revoke all on public.edmingle_student_roster from anon;
grant select on public.edmingle_student_roster to authenticated;

-- Organization IDs are not college identifiers in this Edmingle installation.
update public.edmingle_college_config
set edmingle_organization_id = null, updated_at = now()
where college_id = '11111111-1111-1111-1111-111111111111';

commit;
