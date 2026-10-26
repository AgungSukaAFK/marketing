-- Admin Daily Activity: tanggal aktivitas (sebelumnya hanya created_at).
-- Dibutuhkan supaya import data lama tetap bertanggal sesuai aslinya, bukan
-- tanggal saat di-import. Baris yang sudah ada diisi dari created_at (WIB).
alter table public.admin_daily
  add column if not exists tanggal date;

update public.admin_daily
   set tanggal = (created_at at time zone 'Asia/Jakarta')::date
 where tanggal is null;

alter table public.admin_daily
  alter column tanggal set default ((now() at time zone 'Asia/Jakarta')::date),
  alter column tanggal set not null;

create index if not exists admin_daily_tanggal_idx on public.admin_daily (tenant_id, tanggal desc);
