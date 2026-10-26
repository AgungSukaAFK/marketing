-- Pipeline: probabilitas manual diganti progress otomatis dari stage
-- (dihitung di aplikasi, lib/constants.ts → PIPELINE_PROGRESS), plus riwayat
-- perpindahan stage yang dicatat otomatis oleh trigger.

-- -----------------------------------------------------------------------------
-- Riwayat stage
-- -----------------------------------------------------------------------------
create table if not exists public.pipeline_history (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  pipeline_id uuid not null references public.pipeline (id) on delete cascade,
  from_stage  public.pipeline_stage,            -- null = deal baru dibuat
  to_stage    public.pipeline_stage not null,
  changed_by  uuid references public.profiles (id) on delete set null,
  changed_at  timestamptz not null default now()
);

create index if not exists pipeline_history_pipeline_idx on public.pipeline_history (pipeline_id, changed_at);

alter table public.pipeline_history enable row level security;

-- Terlihat bila deal induknya terlihat (RLS pipeline ikut berlaku di subquery).
-- Tidak ada policy insert/update/delete → hanya trigger di bawah yang menulis.
drop policy if exists pipeline_history_select on public.pipeline_history;
create policy pipeline_history_select on public.pipeline_history for select to authenticated
  using (
    tenant_id = public.current_tenant()
    and exists (select 1 from public.pipeline p where p.id = pipeline_id)
  );

create or replace function public.log_pipeline_stage() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and old.stage is not distinct from new.stage then
    return new;
  end if;
  insert into public.pipeline_history (tenant_id, pipeline_id, from_stage, to_stage, changed_by, changed_at)
  values (
    new.tenant_id,
    new.id,
    case when tg_op = 'UPDATE' then old.stage end,
    new.stage,
    coalesce(auth.uid(), new.owner),
    -- restore backup membawa created_at lama
    case when tg_op = 'INSERT' then new.created_at else now() end
  );
  return new;
end;
$$;

drop trigger if exists pipeline_log_stage on public.pipeline;
create trigger pipeline_log_stage after insert or update of stage on public.pipeline
  for each row execute function public.log_pipeline_stage();

-- Data lama: satu entri awal per deal (stage saat ini, sejak dibuat)
insert into public.pipeline_history (tenant_id, pipeline_id, from_stage, to_stage, changed_by, changed_at)
select p.tenant_id, p.id, null, p.stage, p.owner, p.created_at
  from public.pipeline p
 where not exists (select 1 from public.pipeline_history h where h.pipeline_id = p.id);

-- -----------------------------------------------------------------------------
-- Probabilitas manual tidak dipakai lagi
-- -----------------------------------------------------------------------------
alter table public.pipeline drop column if exists prob;
