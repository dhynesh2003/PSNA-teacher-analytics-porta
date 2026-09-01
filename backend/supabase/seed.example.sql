-- Replace the example values before running.
insert into public.colleges (canonical_name, edmingle_organization_id)
values ('PSNA College of Engineering and Technology', 'REPLACE_WITH_EDMINGLE_ORG_ID')
returning id;

-- Copy the returned college UUID and the test teacher UUID from Authentication > Users.
insert into public.user_college_access (user_id, college_id, role)
values ('REPLACE_WITH_AUTH_USER_UUID', 'REPLACE_WITH_COLLEGE_UUID', 'college_admin');

insert into public.college_aliases (college_id, alias, normalized_alias)
values
  ('REPLACE_WITH_COLLEGE_UUID', 'PSNACET', 'psnacet'),
  ('REPLACE_WITH_COLLEGE_UUID', 'PSNA College Of Engineering and Technology', 'psna college of engineering and technology');
