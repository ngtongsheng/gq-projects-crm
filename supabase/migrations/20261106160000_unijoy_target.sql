-- The yearly target for Unijoy, in m2, one entry per year. The MD or an admin changes it on the
-- dashboard (app_settings policies). 2026 starts at 25,000 m2.
insert into public.app_settings (key, value)
values ('unijoy_target_m2', '{"2026": 25000}')
on conflict (key) do nothing;
