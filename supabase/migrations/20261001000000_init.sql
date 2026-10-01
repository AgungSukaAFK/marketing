-- =============================================================================
-- TITAN APEX V4 — schema awal
-- Multi-tenant (tenant_id + RLS), role: moderator (platform) / master / admin / sales
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Enum
-- -----------------------------------------------------------------------------
create type public.user_role as enum ('moderator', 'master', 'admin', 'sales');

create type public.pipeline_stage as enum (
  'Market Map', 'Lead', 'Qualified', 'Proposal', 'Negotiation', 'PO', 'Delivery', 'Handover'
);

-- -----------------------------------------------------------------------------
-- Tenancy & identitas
-- -----------------------------------------------------------------------------
create table public.tenants (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  code       text not null unique check (code ~ '^[A-Z0-9-]{2,20}$'),
  created_at timestamptz not null default now()
);

-- Profil 1:1 dengan auth.users.
-- Akun baru: active = false, role & tenant kosong → menunggu aktivasi moderator.
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  tenant_id    uuid references public.tenants (id) on delete set null,
  username     text not null unique check (username ~ '^[a-z0-9._-]{3,32}$'),
  name         text not null,
  email        text not null,
  role         public.user_role,
  active       boolean not null default false,
  last_seen_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- akun aktif non-moderator wajib punya tenant & role
  constraint profiles_active_requires_assignment check (
    not active
    or role = 'moderator'
    or (tenant_id is not null and role is not null)
  ),
  constraint profiles_moderator_no_tenant check (role is distinct from 'moderator' or tenant_id is null)
);
create index profiles_tenant_idx on public.profiles (tenant_id);

-- -----------------------------------------------------------------------------
-- Helper RLS. SECURITY DEFINER supaya tidak rekursif terhadap policy profiles.
-- Hanya akun AKTIF yang punya tenant/role efektif.
-- -----------------------------------------------------------------------------
create function public.current_tenant() returns uuid
language sql stable security definer set search_path = '' as $$
  select tenant_id from public.profiles where id = auth.uid() and active
$$;

create function public.auth_role() returns public.user_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create function public.is_tenant_manager() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.auth_role() in ('master', 'admin'), false)
$$;

create function public.is_moderator() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.auth_role() = 'moderator', false)
$$;

-- updated_at otomatis
create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Buat profil saat sign-up. Role/tenant dari metadata SENGAJA diabaikan:
-- penugasan hanya lewat moderator (server action + service role).
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_username text := lower(coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), split_part(new.email, '@', 1)));
begin
  insert into public.profiles (id, username, name, email)
  values (
    new.id,
    v_username,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), v_username),
    new.email
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Konfigurasi per tenant
-- -----------------------------------------------------------------------------
create table public.app_settings (
  tenant_id  uuid primary key references public.tenants (id) on delete cascade,
  app_name   text not null default 'TITAN APEX V4',
  accent     text not null default 'Emerald',
  font       text not null default 'Inter',
  density    text not null default 'Nyaman' check (density in ('Nyaman', 'Kompak')),
  header_cfg jsonb not null default '{"showClock": true, "showBadge": true, "showTheme": true, "showOnline": true}',
  updated_at timestamptz not null default now()
);

create table public.menu_config (
  tenant_id  uuid primary key references public.tenants (id) on delete cascade,
  labels     jsonb not null default '{}',
  icons      jsonb not null default '{}',
  menu_order text[] not null default '{}',
  visibility jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create table public.custom_menus (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null default public.current_tenant() references public.tenants (id) on delete cascade,
  menu_key   text not null check (menu_key ~ '^[a-z0-9_-]{2,32}$'),
  label      text not null,
  icon       text not null default 'file-text',
  content    text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, menu_key)
);

create table public.access_control (
  user_id       uuid primary key references public.profiles (id) on delete cascade,
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  enabled       boolean not null default false,
  allowed_menus text[] not null default '{}',
  updated_at    timestamptz not null default now()
);

create table public.login_history (
  id         bigint generated always as identity primary key,
  tenant_id  uuid references public.tenants (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  action     text not null check (action in ('LOGIN', 'LOGOUT')),
  created_at timestamptz not null default now()
);
create index login_history_tenant_idx on public.login_history (tenant_id, created_at desc);

-- Tenant baru otomatis mendapat baris setting default
create function public.handle_new_tenant() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.app_settings (tenant_id) values (new.id);
  insert into public.menu_config (tenant_id) values (new.id);
  return new;
end $$;

create trigger on_tenant_created after insert on public.tenants
  for each row execute function public.handle_new_tenant();

-- -----------------------------------------------------------------------------
-- Data operasional. Kolom standar: id, tenant_id, owner, created_at, updated_at.
-- tenant_id & owner default dari sesi → client tidak perlu (dan tidak bisa) memalsukan.
-- -----------------------------------------------------------------------------
create table public.customers (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null default public.current_tenant() references public.tenants (id) on delete cascade,
  owner         uuid not null default auth.uid() references public.profiles (id),
  customer_code text not null,
  sales_id      uuid references public.profiles (id) on delete set null,
  pt            text not null,
  pic           text,
  wa            text,
  email         text,
  jabatan       text,
  site          text,
  cuti          text,
  ultah         text,
  tinggal       text,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (tenant_id, customer_code)
);

create table public.sales_daily (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null default public.current_tenant() references public.tenants (id) on delete cascade,
  owner           uuid not null default auth.uid() references public.profiles (id),
  customer_id     uuid not null references public.customers (id) on delete cascade,
  type            text not null default 'Visit',
  status          text not null default 'Completed',
  note            text,
  absensi         text,
  attachment_path text,
  attachment_name text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.admin_daily (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null default public.current_tenant() references public.tenants (id) on delete cascade,
  owner       uuid not null default auth.uid() references public.profiles (id),
  customer_id uuid not null references public.customers (id) on delete cascade,
  type        text not null default 'PO Input',
  ref_no      text,
  dokumen     text,
  status      text not null default 'Draft',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.pipeline (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null default public.current_tenant() references public.tenants (id) on delete cascade,
  owner       uuid not null default auth.uid() references public.profiles (id),
  customer_id uuid not null references public.customers (id) on delete cascade,
  sales_id    uuid references public.profiles (id) on delete set null,
  stage       public.pipeline_stage not null default 'Market Map',
  value       numeric(18, 2) not null default 0 check (value >= 0),
  product     text,
  prob        integer not null default 10 check (prob between 0 and 100),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.sales_forecast (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null default public.current_tenant() references public.tenants (id) on delete cascade,
  owner       uuid not null default auth.uid() references public.profiles (id),
  customer_id uuid not null references public.customers (id) on delete cascade,
  sales_id    uuid references public.profiles (id) on delete set null,
  part_no     text not null,
  deskripsi   text,
  periode     text not null check (periode ~ '^\d{4}-\d{2}$'),
  t_qty       numeric(14, 2) not null default 0,
  t_rp        numeric(18, 2) not null default 0,
  actual_qty  numeric(14, 2) not null default 0,
  actual_rp   numeric(18, 2) not null default 0,
  status      text not null default 'On Track',
  remarks     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.quotation (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null default public.current_tenant() references public.tenants (id) on delete cascade,
  owner       uuid not null default auth.uid() references public.profiles (id),
  customer_id uuid not null references public.customers (id) on delete cascade,
  quot_no     text not null,
  tgl_quot    date,
  tgl_exp     date,
  part        text,
  harga       numeric(18, 2) not null default 0,
  qty         numeric(14, 2) not null default 0,
  margin_p    numeric(6, 2) not null default 0,
  -- nilai turunan: dihitung DB, tidak bisa di-set client
  total       numeric(18, 2) generated always as (harga * qty) stored,
  margin_rp   numeric(18, 2) generated always as (round(harga * qty * margin_p / 100)) stored,
  po_status   text not null default 'Pending',
  loss        numeric(18, 2) not null default 0,
  remarks     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.forecast_trend (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null default public.current_tenant() references public.tenants (id) on delete cascade,
  owner         uuid not null default auth.uid() references public.profiles (id),
  forecast_ref  uuid not null references public.sales_forecast (id) on delete cascade,
  smt1_qty      numeric(14, 2) not null default 0,
  smt2_qty      numeric(14, 2) not null default 0,
  actual_2025   numeric(14, 2) not null default 0,
  forecast_2026 numeric(14, 2) not null default 0,
  alasan        text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.actual_vs_forecast (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null default public.current_tenant() references public.tenants (id) on delete cascade,
  owner       uuid not null default auth.uid() references public.profiles (id),
  customer_id uuid not null references public.customers (id) on delete cascade,
  part_no     text not null,
  target_qty  numeric(14, 2) not null default 0,
  actual_qty  numeric(14, 2) not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.documentation (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null default public.current_tenant() references public.tenants (id) on delete cascade,
  owner       uuid not null default auth.uid() references public.profiles (id),
  customer_id uuid references public.customers (id) on delete set null,
  nama        text not null,
  file_path   text,
  file_name   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.refreshment (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null default public.current_tenant() references public.tenants (id) on delete cascade,
  owner      uuid not null default auth.uid() references public.profiles (id),
  tanggal    date not null default current_date,
  jenis      text not null default 'Weekly Brainstorming',
  topik      text not null,
  durasi     integer not null default 30 check (durasi >= 0),
  peserta    text,
  nilai      text,
  ringkasan  text,
  status     text not null default 'Terjadwal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.evaluation (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null default public.current_tenant() references public.tenants (id) on delete cascade,
  owner      uuid not null default auth.uid() references public.profiles (id),
  periode    text not null check (periode ~ '^\d{4}-\d{2}$'),
  sales_id   uuid references public.profiles (id) on delete set null,
  topik      text not null,
  deskripsi  text,
  skor       integer not null default 75 check (skor between 0 and 100),
  foto_path  text,
  tindak     text,
  status     text not null default 'Open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index tenant + FK
create index customers_tenant_idx          on public.customers (tenant_id);
create index customers_sales_idx           on public.customers (sales_id);
create index sales_daily_tenant_idx        on public.sales_daily (tenant_id);
create index sales_daily_customer_idx      on public.sales_daily (customer_id);
create index admin_daily_tenant_idx        on public.admin_daily (tenant_id);
create index admin_daily_customer_idx      on public.admin_daily (customer_id);
create index pipeline_tenant_idx           on public.pipeline (tenant_id);
create index pipeline_customer_idx         on public.pipeline (customer_id);
create index sales_forecast_tenant_idx     on public.sales_forecast (tenant_id);
create index sales_forecast_customer_idx   on public.sales_forecast (customer_id);
create index quotation_tenant_idx          on public.quotation (tenant_id);
create index quotation_customer_idx        on public.quotation (customer_id);
create index forecast_trend_tenant_idx     on public.forecast_trend (tenant_id);
create index forecast_trend_ref_idx        on public.forecast_trend (forecast_ref);
create index actual_vs_forecast_tenant_idx on public.actual_vs_forecast (tenant_id);
create index documentation_tenant_idx      on public.documentation (tenant_id);
create index refreshment_tenant_idx        on public.refreshment (tenant_id);
create index evaluation_tenant_idx         on public.evaluation (tenant_id);

-- -----------------------------------------------------------------------------
-- Customer code otomatis CUST-0001, unik per tenant (lock per tenant agar tidak race)
-- -----------------------------------------------------------------------------
create function public.assign_customer_code() returns trigger
language plpgsql as $$
declare
  v_next integer;
begin
  if new.customer_code is null or new.customer_code = '' then
    perform pg_advisory_xact_lock(hashtext('customer_code:' || new.tenant_id::text));
    select coalesce(max(substring(customer_code from '^CUST-(\d+)$')::integer), 0) + 1
      into v_next
      from public.customers
     where tenant_id = new.tenant_id;
    new.customer_code := 'CUST-' || lpad(v_next::text, 4, '0');
  end if;
  return new;
end $$;

create trigger customers_assign_code before insert on public.customers
  for each row execute function public.assign_customer_code();

-- Cegah pemindahan baris ke tenant lain / pemalsuan owner lewat UPDATE
create function public.guard_tenant_owner() returns trigger
language plpgsql as $$
begin
  if new.tenant_id <> old.tenant_id then
    raise exception 'tenant_id tidak boleh diubah';
  end if;
  if new.owner <> old.owner and not public.is_tenant_manager() then
    raise exception 'owner hanya bisa diubah Master/Admin';
  end if;
  return new;
end $$;

-- Relasi antar-tabel harus berada di tenant yang sama
create function public.guard_same_tenant_refs() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_data jsonb := to_jsonb(new);
begin
  if v_data ? 'customer_id' and (v_data ->> 'customer_id') is not null then
    if not exists (select 1 from public.customers c where c.id = (v_data ->> 'customer_id')::uuid and c.tenant_id = new.tenant_id) then
      raise exception 'customer tidak ditemukan di tenant ini';
    end if;
  end if;
  if v_data ? 'sales_id' and (v_data ->> 'sales_id') is not null then
    if not exists (select 1 from public.profiles p where p.id = (v_data ->> 'sales_id')::uuid and p.tenant_id = new.tenant_id) then
      raise exception 'sales tidak ditemukan di tenant ini';
    end if;
  end if;
  if v_data ? 'forecast_ref' and (v_data ->> 'forecast_ref') is not null then
    if not exists (select 1 from public.sales_forecast f where f.id = (v_data ->> 'forecast_ref')::uuid and f.tenant_id = new.tenant_id) then
      raise exception 'forecast tidak ditemukan di tenant ini';
    end if;
  end if;
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.tenants            enable row level security;
alter table public.profiles           enable row level security;
alter table public.app_settings       enable row level security;
alter table public.menu_config        enable row level security;
alter table public.custom_menus       enable row level security;
alter table public.access_control     enable row level security;
alter table public.login_history      enable row level security;

-- tenants: anggota baca tenant sendiri, moderator baca semua. Tulis hanya via service role.
create policy tenants_select on public.tenants for select to authenticated
  using (id = public.current_tenant() or public.is_moderator());

-- profiles: baca diri sendiri, rekan satu tenant, atau semua (moderator).
-- Tidak ada policy insert/update/delete → mutasi profil hanya lewat server action (service role).
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or (tenant_id is not null and tenant_id = public.current_tenant())
    or public.is_moderator()
  );

-- app_settings & menu_config: anggota baca, Master/Admin ubah
create policy app_settings_select on public.app_settings for select to authenticated
  using (tenant_id = public.current_tenant());
create policy app_settings_update on public.app_settings for update to authenticated
  using (tenant_id = public.current_tenant() and public.is_tenant_manager())
  with check (tenant_id = public.current_tenant());

create policy menu_config_select on public.menu_config for select to authenticated
  using (tenant_id = public.current_tenant());
create policy menu_config_update on public.menu_config for update to authenticated
  using (tenant_id = public.current_tenant() and public.is_tenant_manager())
  with check (tenant_id = public.current_tenant());

create policy custom_menus_select on public.custom_menus for select to authenticated
  using (tenant_id = public.current_tenant());
create policy custom_menus_write on public.custom_menus for all to authenticated
  using (tenant_id = public.current_tenant() and public.is_tenant_manager())
  with check (tenant_id = public.current_tenant() and public.is_tenant_manager());

-- access_control: user baca miliknya; Master kelola satu tenant
create policy access_control_select on public.access_control for select to authenticated
  using (user_id = auth.uid() or (tenant_id = public.current_tenant() and public.is_tenant_manager()));
create policy access_control_write on public.access_control for all to authenticated
  using (tenant_id = public.current_tenant() and public.auth_role() = 'master')
  with check (
    tenant_id = public.current_tenant()
    and public.auth_role() = 'master'
    and exists (select 1 from public.profiles p where p.id = user_id and p.tenant_id = public.current_tenant())
  );

-- login_history: user mencatat miliknya; Master/Admin baca satu tenant; moderator baca semua
create policy login_history_insert on public.login_history for insert to authenticated
  with check (user_id = auth.uid() and tenant_id is not distinct from public.current_tenant());
create policy login_history_select on public.login_history for select to authenticated
  using (
    user_id = auth.uid()
    or (tenant_id = public.current_tenant() and public.is_tenant_manager())
    or public.is_moderator()
  );

-- Pola seragam untuk tabel operasional:
--   isolasi tenant SELALU; Sales hanya baris miliknya (atau yang di-assign ke dia via sales_id).
do $$
declare
  t text;
  has_sales boolean;
  visible text;
begin
  foreach t in array array[
    'customers', 'sales_daily', 'admin_daily', 'pipeline', 'sales_forecast', 'quotation',
    'forecast_trend', 'actual_vs_forecast', 'documentation', 'refreshment', 'evaluation'
  ] loop
    select exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = t and column_name = 'sales_id'
    ) into has_sales;

    visible := 'owner = auth.uid() or public.is_tenant_manager()'
      || case when has_sales then ' or sales_id = auth.uid()' else '' end;

    execute format('alter table public.%I enable row level security', t);

    execute format(
      'create policy %I on public.%I for select to authenticated using (tenant_id = public.current_tenant() and (%s))',
      t || '_select', t, visible);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (tenant_id = public.current_tenant() and owner = auth.uid())',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (tenant_id = public.current_tenant() and (owner = auth.uid() or public.is_tenant_manager())) with check (tenant_id = public.current_tenant())',
      t || '_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (tenant_id = public.current_tenant() and (owner = auth.uid() or public.is_tenant_manager()))',
      t || '_delete', t);

    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()', t || '_touch', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.guard_tenant_owner()', t || '_guard', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.guard_same_tenant_refs()', t || '_refs', t);
  end loop;
end $$;

create trigger app_settings_touch before update on public.app_settings for each row execute function public.touch_updated_at();
create trigger menu_config_touch before update on public.menu_config for each row execute function public.touch_updated_at();
create trigger custom_menus_touch before update on public.custom_menus for each row execute function public.touch_updated_at();
create trigger access_control_touch before update on public.access_control for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Grants (anon tidak punya akses data apa pun)
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Kolom identitas/tenant pada profiles tidak boleh diubah oleh client sama sekali
revoke insert, update, delete on public.profiles from authenticated;
revoke insert, update, delete on public.tenants from authenticated;
revoke insert, delete on public.app_settings, public.menu_config from authenticated;

-- -----------------------------------------------------------------------------
-- Storage: bucket privat, path wajib diawali tenant_id/
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('files', 'files', false, 10485760)
on conflict (id) do nothing;

create policy files_select on storage.objects for select to authenticated
  using (bucket_id = 'files' and (storage.foldername(name))[1] = public.current_tenant()::text);
create policy files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'files' and (storage.foldername(name))[1] = public.current_tenant()::text);
create policy files_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'files'
    and (storage.foldername(name))[1] = public.current_tenant()::text
    and (owner_id = auth.uid()::text or public.is_tenant_manager())
  );

-- -----------------------------------------------------------------------------
-- Realtime presence: channel privat "tenant:<uuid>" hanya untuk anggota tenant tsb
-- -----------------------------------------------------------------------------
create policy presence_tenant_read on realtime.messages for select to authenticated
  using (realtime.topic() = 'tenant:' || public.current_tenant()::text);
create policy presence_tenant_write on realtime.messages for insert to authenticated
  with check (realtime.topic() = 'tenant:' || public.current_tenant()::text);
