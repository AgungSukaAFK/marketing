-- Refreshment & Assessment: peserta bisa lebih dari 1 (user tenant) + lampiran dokumen.

-- Peserta: text (username) → uuid[] (profiles.id). Nilai lama dipecah per koma
-- dan dicocokkan ke username di tenant yang sama; yang tidak cocok dicatat di
-- ringkasan supaya tidak hilang.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'refreshment'
      and column_name = 'peserta' and data_type = 'text'
  ) then
    alter table public.refreshment add column peserta_ids uuid[] not null default '{}';

    update public.refreshment r
    set peserta_ids = coalesce((
      select array_agg(p.id order by n.ord)
      from unnest(string_to_array(r.peserta, ',')) with ordinality as n(name, ord)
      join public.profiles p on p.username = lower(trim(n.name)) and p.tenant_id = r.tenant_id
    ), '{}')
    where r.peserta is not null;

    update public.refreshment r
    set ringkasan = concat_ws(E'\n', nullif(r.ringkasan, ''), 'Peserta lain: ' || un.names)
    from (
      select r2.id, string_agg(trim(n.name), ', ' order by n.ord) as names
      from public.refreshment r2
      cross join unnest(string_to_array(r2.peserta, ',')) with ordinality as n(name, ord)
      where trim(n.name) not in ('', '-')
        and not exists (
          select 1 from public.profiles p
          where p.username = lower(trim(n.name)) and p.tenant_id = r2.tenant_id
        )
      group by r2.id
    ) un
    where un.id = r.id;

    alter table public.refreshment drop column peserta;
    alter table public.refreshment rename column peserta_ids to peserta;
  end if;
end $$;

-- Daftar lampiran: [{ "path": "<tenant>/refreshment/...", "name": "...", "size": 123 }]
alter table public.refreshment
  add column if not exists attachments jsonb not null default '[]'::jsonb;

alter table public.refreshment
  drop constraint if exists refreshment_attachments_is_array;
alter table public.refreshment
  add constraint refreshment_attachments_is_array check (jsonb_typeof(attachments) = 'array');
