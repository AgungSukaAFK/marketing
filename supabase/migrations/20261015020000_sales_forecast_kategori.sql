-- Sales Forecast: kategori part (AC Part, Electrical, Man Power, Light Vehicle).
-- Nullable supaya baris lama tetap valid; form mewajibkan isi saat simpan.
alter table public.sales_forecast
  add column if not exists kategori text;

alter table public.sales_forecast
  drop constraint if exists sales_forecast_kategori_check;

alter table public.sales_forecast
  add constraint sales_forecast_kategori_check
  check (kategori is null or kategori in ('AC Part', 'Electrical', 'Man Power', 'Light Vehicle'));
