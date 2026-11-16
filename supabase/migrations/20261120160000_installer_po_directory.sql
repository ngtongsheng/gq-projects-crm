-- Loop 24 task 06 (D5): every installer PO points at one installer in the directory, so one MOF
-- cannot hold two POs for the same installer under different spellings ("Leong" and "leong").
-- Additive: the installer text column keeps every value and now mirrors the directory name.
-- Dropping it is a later, approved step.

-- Names typed on POs since the directory was made become directory installers. The spelling
-- used most often wins, as in the directory's own backfill.
insert into public.installers (name)
select distinct on (name_key) name
from (
  select regexp_replace(installer, '\s+', ' ', 'g') as name,
    lower(regexp_replace(installer, '\s+', ' ', 'g')) as name_key,
    count(*) as uses
  from public.installer_pos
  group by 1, 2
) spellings
order by name_key, uses desc, name
on conflict (name_key) do nothing;

alter table public.installer_pos
  add column installer_id uuid references public.installers (id);

update public.installer_pos p
set installer_id = i.id
from public.installers i
where i.name_key = lower(regexp_replace(p.installer, '\s+', ' ', 'g'));

-- Two POs on one MOF for the same installer under different spellings hold money records that
-- someone has to merge by hand; the migration stops and names them instead of guessing.
do $$
declare
  duplicates text;
begin
  select string_agg(line, '; ' order by line) into duplicates
  from (
    select format('MOF %s (%s): POs %s name %s', m.mof_no, p.mof_id,
        string_agg(p.po_no, ', ' order by p.po_no),
        string_agg(p.installer, ' / ' order by p.po_no)) as line
    from public.installer_pos p
    join public.mofs m on m.id = p.mof_id
    group by p.mof_id, m.mof_no, p.installer_id
    having count(*) > 1
  ) found;
  if duplicates is not null then
    raise exception 'Installer POs name the same installer twice on one MOF. Merge them first: %',
      duplicates;
  end if;
end;
$$;

alter table public.installer_pos
  alter column installer_id set not null,
  add constraint installer_pos_mof_id_installer_id_key unique (mof_id, installer_id);

create index installer_pos_installer_id_idx on public.installer_pos (installer_id);

-- The app now picks the installer; the name is written from the directory below.
revoke insert (installer), update (installer) on table public.installer_pos from authenticated;
grant insert (installer_id), update (installer_id) on table public.installer_pos to authenticated;

-- Writes the picked installer's directory name into the installer text column while both exist.
create function public.link_installer_po_installer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select name into new.installer from public.installers where id = new.installer_id;
  if not found then
    raise exception 'Choose an installer from the directory.' using errcode = '23503';
  end if;
  return new;
end;
$$;

revoke execute on function public.link_installer_po_installer() from public, anon, authenticated;

create trigger link_installer_po_installer
  before insert or update of installer_id, installer on public.installer_pos
  for each row execute function public.link_installer_po_installer();
