-- Pipeline: field Product diganti Kategori (Retail, Kontrak, Consigment, Jasa).
-- Nullable supaya baris lama tetap valid; form mewajibkan isi saat simpan.
alter table public.pipeline
  add column if not exists kategori text;

alter table public.pipeline
  drop constraint if exists pipeline_kategori_check;

alter table public.pipeline
  add constraint pipeline_kategori_check
  check (kategori is null or kategori in ('Retail', 'Kontrak', 'Consigment', 'Jasa'));

alter table public.pipeline
  drop column if exists product;
