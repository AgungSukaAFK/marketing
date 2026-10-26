-- Nama part (deskripsi) ditampilkan di samping Part No.

-- 1) Sales Actual vs Forecast: Part Description seperti Sales Forecast.
--    Baris lama diisi dari Sales Forecast dengan Part No yang sama (tenant sama).
alter table public.actual_vs_forecast
  add column if not exists deskripsi text;

update public.actual_vs_forecast a
   set deskripsi = (
     select f.deskripsi
       from public.sales_forecast f
      where f.tenant_id = a.tenant_id
        and lower(f.part_no) = lower(a.part_no)
        and nullif(trim(f.deskripsi), '') is not null
      order by f.updated_at desc
      limit 1)
 where a.deskripsi is null;

-- 2) Saran part combobox quotation: ikut membawa nama part dari Sales Forecast
--    dan bisa dicari lewat nama. Tipe return berubah → drop dulu.
drop function if exists public.search_quotation_parts(text, integer);

create function public.search_quotation_parts(p_q text default '', p_limit integer default 20)
returns table (part text, source text, deskripsi text)
language sql stable security invoker set search_path = '' as $$
  with hits as (
    select i.part, 'Quotation'::text as source, max(i.created_at) as last_used
      from public.quotation_items i
     where i.part ilike '%' || coalesce(p_q, '') || '%' and i.part <> '-'
     group by i.part
    union all
    select f.part_no, 'Forecast', max(f.created_at)
      from public.sales_forecast f
     where f.part_no ilike '%' || coalesce(p_q, '') || '%'
        or f.deskripsi ilike '%' || coalesce(p_q, '') || '%'
     group by f.part_no
  ),
  picked as (
    select distinct on (lower(h.part)) h.part, h.source
      from hits h
     order by lower(h.part), h.source desc, h.last_used desc
     limit least(greatest(coalesce(p_limit, 20), 1), 20)
  )
  select p.part, p.source, d.deskripsi
    from picked p
    left join lateral (
      select f.deskripsi
        from public.sales_forecast f
       where lower(f.part_no) = lower(p.part) and nullif(trim(f.deskripsi), '') is not null
       order by f.updated_at desc
       limit 1
    ) d on true
   order by lower(p.part);
$$;

revoke all on function public.search_quotation_parts(text, integer) from public, anon;
grant execute on function public.search_quotation_parts(text, integer) to authenticated;
