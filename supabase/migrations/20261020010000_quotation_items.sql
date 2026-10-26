-- Monitoring Quotation: satu quotation bisa berisi banyak barang, masing-masing
-- dengan status negosiasi sendiri (Draft/Negosiasi/Win/Loss/Cancel).
-- Header quotation mendapat Kode Accurate; Loss tidak diinput lagi, melainkan
-- dihitung di aplikasi dari total barang berstatus Loss.

alter table public.quotation add column if not exists kode_accurate text;

-- -----------------------------------------------------------------------------
-- Barang quotation
-- -----------------------------------------------------------------------------
create table if not exists public.quotation_items (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  quotation_id uuid not null references public.quotation (id) on delete cascade,
  position     integer not null default 0,
  part         text not null,
  harga        numeric(18, 2) not null default 0,
  qty          numeric(14, 2) not null default 0,
  margin_p     numeric(6, 2) not null default 0,
  -- nilai turunan: dihitung DB, tidak bisa di-set client
  total        numeric(18, 2) generated always as (harga * qty) stored,
  margin_rp    numeric(18, 2) generated always as (round(harga * qty * margin_p / 100)) stored,
  status       text not null default 'Draft'
               check (status in ('Draft', 'Negosiasi', 'Win', 'Loss', 'Cancel')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists quotation_items_quotation_idx on public.quotation_items (quotation_id, position);
create index if not exists quotation_items_tenant_idx on public.quotation_items (tenant_id);

-- tenant_id selalu ikut quotation induk (client tidak bisa memalsukan)
create or replace function public.quotation_items_set_tenant() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select q.tenant_id into new.tenant_id from public.quotation q where q.id = new.quotation_id;
  if new.tenant_id is null then
    raise exception 'quotation tidak ditemukan';
  end if;
  return new;
end $$;

drop trigger if exists quotation_items_tenant on public.quotation_items;
create trigger quotation_items_tenant before insert or update of quotation_id, tenant_id on public.quotation_items
  for each row execute function public.quotation_items_set_tenant();

drop trigger if exists quotation_items_touch on public.quotation_items;
create trigger quotation_items_touch before update on public.quotation_items
  for each row execute function public.touch_updated_at();

alter table public.quotation_items enable row level security;

-- Terlihat bila quotation induk terlihat (RLS quotation ikut berlaku di subquery);
-- diubah bila quotation induk boleh diubah (pemilik atau Master/Admin).
drop policy if exists quotation_items_select on public.quotation_items;
create policy quotation_items_select on public.quotation_items for select to authenticated
  using (
    tenant_id = public.current_tenant()
    and exists (select 1 from public.quotation q where q.id = quotation_id)
  );

drop policy if exists quotation_items_write on public.quotation_items;
create policy quotation_items_write on public.quotation_items for all to authenticated
  using (
    tenant_id = public.current_tenant()
    and exists (
      select 1 from public.quotation q
       where q.id = quotation_id and (q.owner = auth.uid() or public.is_tenant_manager())
    )
  )
  with check (
    tenant_id = public.current_tenant()
    and exists (
      select 1 from public.quotation q
       where q.id = quotation_id and (q.owner = auth.uid() or public.is_tenant_manager())
    )
  );

grant select, insert, update, delete on public.quotation_items to authenticated;
revoke all on public.quotation_items from anon;

-- -----------------------------------------------------------------------------
-- Data lama: tiap quotation jadi satu barang. PO Status 'Pending' → 'Negosiasi'.
-- Loss manual yang tidak tercermin di status dicatat di remarks agar tidak hilang.
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'quotation' and column_name = 'po_status'
  ) then
    insert into public.quotation_items (tenant_id, quotation_id, position, part, harga, qty, margin_p, status, created_at)
    select q.tenant_id, q.id, 0, coalesce(nullif(trim(q.part), ''), '-'), q.harga, q.qty, q.margin_p,
           case when q.po_status in ('Win', 'Loss', 'Cancel') then q.po_status else 'Negosiasi' end,
           q.created_at
      from public.quotation q
     where not exists (select 1 from public.quotation_items i where i.quotation_id = q.id);

    update public.quotation
       set remarks = concat_ws(E'\n', nullif(remarks, ''), 'Loss (data lama): Rp ' || replace(to_char(loss, 'FM999,999,999,990'), ',', '.'))
     where loss > 0 and po_status <> 'Loss';
  end if;
end $$;

alter table public.quotation
  drop column if exists total,
  drop column if exists margin_rp,
  drop column if exists part,
  drop column if exists harga,
  drop column if exists qty,
  drop column if exists margin_p,
  drop column if exists po_status,
  drop column if exists loss;

-- -----------------------------------------------------------------------------
-- Simpan header + barang dalam satu transaksi. security invoker → RLS tetap
-- berlaku persis seperti insert/update biasa dari client.
-- -----------------------------------------------------------------------------
create or replace function public.save_quotation(p_id uuid, p_header jsonb, p_items jsonb)
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Minimal 1 barang';
  end if;

  if p_id is null then
    insert into public.quotation (customer_id, quot_no, kode_accurate, tgl_quot, tgl_exp, remarks)
    values (
      (p_header ->> 'customer_id')::uuid,
      p_header ->> 'quot_no',
      p_header ->> 'kode_accurate',
      (p_header ->> 'tgl_quot')::date,
      (p_header ->> 'tgl_exp')::date,
      p_header ->> 'remarks'
    )
    returning id into v_id;
  else
    update public.quotation
       set customer_id   = (p_header ->> 'customer_id')::uuid,
           quot_no       = p_header ->> 'quot_no',
           kode_accurate = p_header ->> 'kode_accurate',
           tgl_quot      = (p_header ->> 'tgl_quot')::date,
           tgl_exp       = (p_header ->> 'tgl_exp')::date,
           remarks       = p_header ->> 'remarks'
     where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Data tidak ditemukan atau tidak berwenang' using errcode = '42501';
    end if;
    delete from public.quotation_items where quotation_id = v_id;
  end if;

  insert into public.quotation_items (quotation_id, position, part, harga, qty, margin_p, status)
  select v_id, (t.ord - 1)::integer, t.e ->> 'part', (t.e ->> 'harga')::numeric, (t.e ->> 'qty')::numeric,
         (t.e ->> 'margin_p')::numeric, t.e ->> 'status'
    from jsonb_array_elements(p_items) with ordinality as t (e, ord);

  return v_id;
end $$;

revoke all on function public.save_quotation(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_quotation(uuid, jsonb, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- Saran nama part untuk combobox (maks. p_limit, default 20): dari barang
-- quotation sebelumnya + Part No di Sales Forecast. RLS berlaku (invoker).
-- -----------------------------------------------------------------------------
create or replace function public.search_quotation_parts(p_q text default '', p_limit integer default 20)
returns table (part text, source text)
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
     group by f.part_no
  )
  select distinct on (lower(h.part)) h.part, h.source
    from hits h
   order by lower(h.part), h.source desc, h.last_used desc
   limit least(greatest(coalesce(p_limit, 20), 1), 20);
$$;

revoke all on function public.search_quotation_parts(text, integer) from public, anon;
grant execute on function public.search_quotation_parts(text, integer) to authenticated;
