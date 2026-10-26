-- Activity History (khusus moderator): setiap aksi tiap akun tercatat lengkap.
--
-- activity_log      satu baris per aksi (satu request server = satu klik user):
--                   siapa, kapan, dari mana (IP/perangkat), aksi apa, data mana.
-- activity_changes  rincian perubahan data di balik aksi tsb, dicatat trigger per
--                   baris: snapshot data + nilai sebelum → sesudah.
--
-- Perubahan data dicatat trigger DB, jadi tidak terlewat walau data ditulis di
-- luar aplikasi. Event non-data (login, export, download, …) ditulis server lewat
-- service role (lib/activity.ts). Semua yang terjadi dalam satu request digabung
-- lewat header x-activity-request (dibuat proxy.ts per request).
--
-- Disimpan selamanya; moderator bisa menghapus per periode (purge_activity_log)
-- dan penghapusan itu sendiri ikut tercatat.
--
-- Idempoten. Jalankan ulang setelah migration user_preferences supaya tabel itu
-- ikut dipantau.

-- -----------------------------------------------------------------------------
-- Tabel
-- -----------------------------------------------------------------------------
create table if not exists public.activity_log (
  id             bigint generated always as identity primary key,
  created_at     timestamptz not null default now(),
  request_id     text not null,
  -- tanpa FK: log tetap utuh walau akun / company dihapus. Nama disimpan sebagai
  -- snapshot saat aksi terjadi.
  actor_id       uuid,
  actor_name     text,
  actor_username text,
  actor_role     text,
  tenant_id      uuid,
  action         text not null,
  entity         text,
  record_id      text,
  label          text,
  -- kolom yang berubah pada perubahan utama (aksi "update")
  fields         text[] not null default '{}',
  change_count   integer not null default 0,
  -- kedalaman trigger perubahan utama; 0 = event aplikasi (tidak ditimpa trigger)
  depth          smallint not null default 0,
  ip             text,
  user_agent     text,
  meta           jsonb not null default '{}'::jsonb check (jsonb_typeof(meta) = 'object')
);

-- satu baris per (request, pelaku); NULLS NOT DISTINCT: pelaku tak dikenal pun digabung
create unique index if not exists activity_log_request_idx on public.activity_log (request_id, actor_id) nulls not distinct;
create index if not exists activity_log_created_idx on public.activity_log (created_at desc, id desc);
create index if not exists activity_log_actor_idx   on public.activity_log (actor_id, created_at desc);
create index if not exists activity_log_tenant_idx  on public.activity_log (tenant_id, created_at desc);
create index if not exists activity_log_record_idx  on public.activity_log (entity, record_id);

create table if not exists public.activity_changes (
  id          bigint generated always as identity primary key,
  activity_id bigint not null references public.activity_log (id) on delete cascade,
  created_at  timestamptz not null default now(),
  entity      text not null,
  op          text not null check (op in ('INSERT', 'UPDATE', 'DELETE')),
  record_id   text,
  label       text,
  -- pg_trigger_depth(): > 1 = ditulis trigger lain (mis. setting default company baru).
  -- Hapus berantai lewat FK tetap 1 — dikenali dari entitas yang beda dengan aksi utamanya.
  depth       smallint not null default 1,
  fields      text[] not null default '{}',
  -- UPDATE: hanya nilai lama kolom yang berubah · DELETE: seluruh baris
  old_data    jsonb,
  -- INSERT / UPDATE: seluruh baris sesudah perubahan
  new_data    jsonb
);

create index if not exists activity_changes_activity_idx on public.activity_changes (activity_id, id);
create index if not exists activity_changes_record_idx   on public.activity_changes (entity, record_id, id desc);

-- -----------------------------------------------------------------------------
-- Konteks request PostgREST: id request, pelaku, IP & perangkat.
-- Kosong bila dari SQL Editor / proses internal → request = transaksi.
-- -----------------------------------------------------------------------------
create or replace function public.activity_request() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_claims jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  v_hdr    jsonb := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
  v_actor  text;
begin
  -- Server (service role) menyebut pelaku lewat header; selain itu dari JWT,
  -- jadi pengguna biasa tidak bisa mengatasnamakan akun lain.
  v_actor := case when v_claims ->> 'role' = 'service_role' then v_hdr ->> 'x-activity-actor' else v_claims ->> 'sub' end;
  return jsonb_build_object(
    'request_id', coalesce(nullif(left(v_hdr ->> 'x-activity-request', 64), ''), 'tx:' || pg_current_xact_id()::text),
    'actor_id', case when v_actor ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then v_actor end,
    'ip', left(coalesce(
      nullif(v_hdr ->> 'x-activity-ip', ''),
      nullif(trim(split_part(v_hdr ->> 'x-forwarded-for', ',', 1)), ''),
      v_hdr ->> 'x-real-ip'), 64),
    'user_agent', left(coalesce(nullif(v_hdr ->> 'x-activity-ua', ''), v_hdr ->> 'user-agent'), 500)
  );
end $$;

-- Nama data yang mudah dibaca, disimpan saat aksi terjadi (tetap terbaca walau
-- datanya kemudian diubah / dihapus).
create or replace function public.activity_label(p_entity text, r jsonb) returns text
language sql stable security definer set search_path = '' as $$
  select left(nullif(btrim(case p_entity
    when 'customers' then concat_ws(' · ', r ->> 'customer_code', r ->> 'pt')
    when 'sales_daily' then concat_ws(' · ', r ->> 'type',
      (select c.pt from public.customers c where c.id = (r ->> 'customer_id')::uuid))
    when 'admin_daily' then concat_ws(' · ', r ->> 'type', nullif(r ->> 'ref_no', ''),
      (select c.pt from public.customers c where c.id = (r ->> 'customer_id')::uuid))
    when 'pipeline' then concat_ws(' · ',
      (select c.pt from public.customers c where c.id = (r ->> 'customer_id')::uuid), r ->> 'stage')
    when 'sales_forecast' then concat_ws(' · ', r ->> 'part_no', r ->> 'periode')
    when 'quotation' then concat_ws(' · ', r ->> 'quot_no',
      (select c.pt from public.customers c where c.id = (r ->> 'customer_id')::uuid))
    when 'quotation_items' then r ->> 'part'
    when 'forecast_trend' then
      (select concat_ws(' · ', f.part_no, f.periode) from public.sales_forecast f where f.id = (r ->> 'forecast_ref')::uuid)
    when 'actual_vs_forecast' then concat_ws(' · ', r ->> 'part_no',
      (select c.pt from public.customers c where c.id = (r ->> 'customer_id')::uuid))
    when 'documentation' then r ->> 'nama'
    when 'refreshment' then concat_ws(' · ', r ->> 'topik', r ->> 'tanggal')
    when 'evaluation' then concat_ws(' · ', r ->> 'topik', r ->> 'periode')
    when 'profiles' then concat(r ->> 'name', ' (@' || (r ->> 'username') || ')')
    when 'tenants' then concat(r ->> 'name', ' (' || (r ->> 'code') || ')')
    when 'app_settings' then 'Tampilan aplikasi'
    when 'menu_config' then 'Konfigurasi menu'
    when 'custom_menus' then r ->> 'label'
    when 'access_control' then
      (select concat(p.name, ' (@' || p.username || ')') from public.profiles p where p.id = (r ->> 'user_id')::uuid)
    when 'user_preferences' then concat('Tampilan ', initcap(r ->> 'key'))
  end), ''), 200)
$$;

-- -----------------------------------------------------------------------------
-- Trigger pencatat perubahan (AFTER ROW di semua tabel yang dipantau)
-- -----------------------------------------------------------------------------
create or replace function public.activity_capture() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_old      jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_new      jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_row      jsonb := coalesce(v_new, v_old);
  v_depth    int := pg_trigger_depth();
  v_fields   text[] := '{}';
  v_diff     jsonb;
  v_req      jsonb;
  v_actor    uuid;
  v_record   text;
  v_label    text;
  v_tenant   uuid;
  -- ringkasan untuk activity_log (bisa beda dengan baris ini, mis. barang → quotation)
  v_action   text := case tg_op when 'INSERT' then 'create' when 'UPDATE' then 'update' else 'delete' end;
  v_entity   text := tg_table_name;
  v_h_record text;
  v_h_label  text;
  v_id       bigint;
  v_h_depth  int;
  v_name     text;
  v_username text;
  v_role     text;
  v_a_tenant uuid;
begin
  -- Perubahan oleh Supabase Auth (profil dibuat saat registrasi / terhapus
  -- berantai saat akun dihapus) — event-nya sudah dicatat aplikasi.
  if session_user = 'supabase_auth_admin' then
    return null;
  end if;

  begin
    if tg_op = 'UPDATE' then
      select coalesce(array_agg(n.key order by n.key), '{}'), jsonb_object_agg(n.key, v_old -> n.key)
        into v_fields, v_diff
        from jsonb_each(v_new) n
       where n.key not in ('updated_at', 'last_seen_at')
         and n.value is distinct from v_old -> n.key;
      -- tidak ada yang berubah (mis. simpan tanpa edit, atau hanya last_seen_at saat login)
      if cardinality(v_fields) = 0 then
        return null;
      end if;
    end if;

    v_req := public.activity_request();
    v_actor := (v_req ->> 'actor_id')::uuid;
    -- Efek samping trigger lain tanpa pelaku (mis. setting default saat company
    -- dibuat dari SQL Editor) — perubahan utamanya sudah tercatat.
    if v_actor is null and v_depth > 1 then
      return null;
    end if;

    v_record := coalesce(v_row ->> 'id', case tg_table_name
      when 'user_preferences' then concat(v_row ->> 'user_id', ':', v_row ->> 'key')
      when 'access_control' then v_row ->> 'user_id'
      else v_row ->> 'tenant_id' end);
    v_label := public.activity_label(tg_table_name, v_row);
    v_tenant := nullif(case when tg_table_name = 'tenants' then v_row ->> 'id' else v_row ->> 'tenant_id' end, '')::uuid;
    v_h_record := v_record;
    v_h_label := v_label;

    -- Barang quotation adalah bagian dari quotation induknya
    if tg_table_name = 'quotation_items' and v_depth = 1 then
      v_entity := 'quotation';
      v_action := 'update';
      v_h_record := v_row ->> 'quotation_id';
      select public.activity_label('quotation', to_jsonb(q)) into v_h_label
        from public.quotation q where q.id = (v_row ->> 'quotation_id')::uuid;
    end if;

    update public.activity_log l
       set change_count = l.change_count + 1
     where l.request_id = v_req ->> 'request_id' and l.actor_id is not distinct from v_actor
    returning l.id, l.depth into v_id, v_h_depth;

    if v_id is null then
      select p.name, p.username, p.role::text, p.tenant_id
        into v_name, v_username, v_role, v_a_tenant
        from public.profiles p where p.id = v_actor;
      insert into public.activity_log (
        request_id, actor_id, actor_name, actor_username, actor_role, tenant_id,
        action, entity, record_id, label, fields, change_count, depth, ip, user_agent)
      values (
        v_req ->> 'request_id', v_actor, v_name, v_username, v_role, coalesce(v_tenant, v_a_tenant),
        v_action, v_entity, v_h_record, v_h_label, v_fields, 1, v_depth, v_req ->> 'ip', v_req ->> 'user_agent')
      on conflict (request_id, actor_id) do update set change_count = public.activity_log.change_count + 1
      returning id into v_id;
    elsif v_depth < v_h_depth then
      -- Perubahan langsung lebih utama daripada perubahan berantai yang tercatat
      -- lebih dulu (mis. hapus customer → activity cascade-nya diproses duluan)
      update public.activity_log l
         set action = v_action, entity = v_entity, record_id = v_h_record, label = v_h_label,
             fields = v_fields, depth = v_depth, tenant_id = coalesce(v_tenant, l.tenant_id)
       where l.id = v_id;
    end if;

    insert into public.activity_changes (activity_id, entity, op, record_id, label, depth, fields, old_data, new_data)
    values (v_id, tg_table_name, tg_op, v_record, v_label, v_depth, v_fields,
            case tg_op when 'UPDATE' then v_diff when 'DELETE' then v_old end, v_new);
  exception when others then
    -- Pencatatan tidak boleh menggagalkan penyimpanan data
    raise warning 'activity_capture %.%: % (%)', tg_table_name, tg_op, sqlerrm, sqlstate;
  end;
  return null;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'customers', 'sales_daily', 'admin_daily', 'pipeline', 'sales_forecast', 'quotation', 'quotation_items',
    'forecast_trend', 'actual_vs_forecast', 'documentation', 'refreshment', 'evaluation',
    'profiles', 'tenants', 'app_settings', 'menu_config', 'custom_menus', 'access_control', 'user_preferences'
  ] loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('drop trigger if exists activity_capture on public.%I', t);
    execute format(
      'create trigger activity_capture after insert or update or delete on public.%I for each row execute function public.activity_capture()',
      t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Hapus log per periode — khusus moderator. Penghapusan ikut tercatat.
-- -----------------------------------------------------------------------------
create or replace function public.purge_activity_log(p_from timestamptz, p_to timestamptz) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_req   jsonb := public.activity_request();
  v_count integer;
begin
  if not public.is_moderator() then
    raise exception 'Hanya moderator' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_from >= p_to then
    raise exception 'Periode tidak valid' using errcode = '22023';
  end if;

  delete from public.activity_log where created_at >= p_from and created_at < p_to;
  get diagnostics v_count = row_count;

  insert into public.activity_log (
    request_id, actor_id, actor_name, actor_username, actor_role,
    action, entity, label, depth, ip, user_agent, meta)
  select v_req ->> 'request_id', p.id, p.name, p.username, p.role::text,
         'log_purge', 'activity_log', v_count || ' log dihapus', 0, v_req ->> 'ip', v_req ->> 'user_agent',
         jsonb_build_object('from', p_from, 'to', p_to, 'deleted', v_count)
    from public.profiles p
   where p.id = auth.uid()
  on conflict (request_id, actor_id) do update
    set action = excluded.action, entity = excluded.entity, label = excluded.label,
        depth = 0, meta = excluded.meta;

  return v_count;
end $$;

-- -----------------------------------------------------------------------------
-- Akses: hanya moderator yang bisa membaca. Tidak ada yang bisa mengubah lewat
-- API kecuali server (service role) untuk event aplikasi.
-- -----------------------------------------------------------------------------
alter table public.activity_log     enable row level security;
alter table public.activity_changes enable row level security;

drop policy if exists activity_log_select on public.activity_log;
create policy activity_log_select on public.activity_log for select to authenticated
  using ((select public.is_moderator()));

drop policy if exists activity_changes_select on public.activity_changes;
create policy activity_changes_select on public.activity_changes for select to authenticated
  using ((select public.is_moderator()));

revoke all on public.activity_log, public.activity_changes from anon, authenticated;
grant select on public.activity_log, public.activity_changes to authenticated;
grant select, insert, update on public.activity_log to service_role;
grant select on public.activity_changes to service_role;

revoke all on function public.activity_request() from public, anon, authenticated;
revoke all on function public.activity_label(text, jsonb) from public, anon, authenticated;
revoke all on function public.activity_capture() from public, anon, authenticated;
revoke all on function public.purge_activity_log(timestamptz, timestamptz) from public, anon;
grant execute on function public.purge_activity_log(timestamptz, timestamptz) to authenticated;

-- -----------------------------------------------------------------------------
-- Riwayat login/logout lama ikut masuk (tanpa IP & perangkat — belum dicatat).
-- Hanya saat tabel masih kosong, supaya log yang sudah dihapus moderator tidak
-- kembali ketika migration ini dijalankan ulang.
-- -----------------------------------------------------------------------------
insert into public.activity_log (
  created_at, request_id, actor_id, actor_name, actor_username, actor_role, tenant_id, action, entity, depth, meta)
select h.created_at, 'login_history:' || h.id, h.user_id, p.name, p.username, p.role::text, h.tenant_id,
       lower(h.action), 'auth', 0, '{"imported": true}'::jsonb
  from public.login_history h
  left join public.profiles p on p.id = h.user_id
 where not exists (select 1 from public.activity_log)
on conflict (request_id, actor_id) do nothing;
