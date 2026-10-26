-- Preferensi tampilan per user (layout Dashboard & Analytics: widget yang
-- tampil, urutan, ukuran, periode default). Satu baris per user per halaman.
-- Isi divalidasi Zod di server action (lib/prefs.ts); DB hanya memastikan objek.
create table if not exists public.user_preferences (
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  key        text not null check (key in ('dashboard', 'analytics')),
  value      jsonb not null default '{}'::jsonb check (jsonb_typeof(value) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.user_preferences enable row level security;

-- Hanya milik sendiri
drop policy if exists user_preferences_select on public.user_preferences;
create policy user_preferences_select on public.user_preferences for select to authenticated
  using (user_id = auth.uid());
drop policy if exists user_preferences_insert on public.user_preferences;
create policy user_preferences_insert on public.user_preferences for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists user_preferences_update on public.user_preferences;
create policy user_preferences_update on public.user_preferences for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
drop policy if exists user_preferences_delete on public.user_preferences;
create policy user_preferences_delete on public.user_preferences for delete to authenticated
  using (user_id = auth.uid());

drop trigger if exists user_preferences_touch on public.user_preferences;
create trigger user_preferences_touch before update on public.user_preferences
  for each row execute function public.touch_updated_at();

grant select, insert, update, delete on public.user_preferences to authenticated;
revoke all on public.user_preferences from anon;

-- -----------------------------------------------------------------------------
-- Index untuk filter periode Dashboard & Analytics (tenant + tanggal)
-- -----------------------------------------------------------------------------
create index if not exists sales_daily_tenant_created_idx    on public.sales_daily (tenant_id, created_at);
create index if not exists pipeline_tenant_created_idx       on public.pipeline (tenant_id, created_at);
create index if not exists pipeline_history_changed_idx      on public.pipeline_history (tenant_id, changed_at);
create index if not exists sales_forecast_tenant_periode_idx on public.sales_forecast (tenant_id, periode);
create index if not exists quotation_tenant_tgl_idx          on public.quotation (tenant_id, tgl_quot);
create index if not exists quotation_tenant_exp_idx          on public.quotation (tenant_id, tgl_exp);
create index if not exists customers_tenant_created_idx      on public.customers (tenant_id, created_at);
create index if not exists refreshment_tenant_tanggal_idx    on public.refreshment (tenant_id, tanggal);
