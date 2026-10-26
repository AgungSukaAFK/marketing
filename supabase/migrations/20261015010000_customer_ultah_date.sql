-- Customer DB: "Ulang Tahun Perusahaan" jadi kolom date (sebelumnya teks bebas)
-- untuk reminder H-10 di dashboard.
--
-- Teks lama dikonversi bila formatnya lengkap (punya tahun):
--   2020-03-12 · 12/03/2020 · 12-03-2020 · 12.03.2020 · 12 Mar 2020 · 12 Maret 2020
-- Yang tidak bisa dikonversi (mis. "12 Mar" tanpa tahun) disalin ke kolom note
-- sebagai "Ulang tahun (data lama): ..." lalu dikosongkan — isi ulang via form.

create or replace function pg_temp.parse_ultah(t text) returns date
language plpgsql immutable as $$
declare
  s text := lower(btrim(coalesce(t, '')));
  m text[];
  mon int;
begin
  if s = '' or s = '-' then return null; end if;

  m := regexp_match(s, '^(\d{4})-(\d{1,2})-(\d{1,2})$');
  if m is not null then
    return make_date(m[1]::int, m[2]::int, m[3]::int);
  end if;

  m := regexp_match(s, '^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$');
  if m is not null then
    return make_date(m[3]::int, m[2]::int, m[1]::int);
  end if;

  m := regexp_match(s, '^(\d{1,2})\s+([a-z]+)\.?\s+(\d{4})$');
  if m is not null then
    mon := case left(m[2], 3)
      when 'jan' then 1 when 'feb' then 2 when 'mar' then 3 when 'apr' then 4
      when 'mei' then 5 when 'may' then 5 when 'jun' then 6 when 'jul' then 7
      when 'agu' then 8 when 'agt' then 8 when 'aug' then 8 when 'sep' then 9
      when 'okt' then 10 when 'oct' then 10 when 'nov' then 11
      when 'des' then 12 when 'dec' then 12
    end;
    if mon is not null then
      return make_date(m[3]::int, mon, m[1]::int);
    end if;
  end if;

  return null;
exception when others then
  return null; -- mis. 31/02/2020
end;
$$;

do $$
begin
  -- idempoten: lewati bila kolom sudah bertipe date
  if (select data_type from information_schema.columns
       where table_schema = 'public' and table_name = 'customers' and column_name = 'ultah') = 'date' then
    return;
  end if;

  update public.customers
     set note = concat_ws(E'\n', nullif(note, ''), 'Ulang tahun (data lama): ' || btrim(ultah))
   where btrim(coalesce(ultah, '')) not in ('', '-')
     and pg_temp.parse_ultah(ultah) is null;

  alter table public.customers
    alter column ultah type date using pg_temp.parse_ultah(ultah);
end $$;
