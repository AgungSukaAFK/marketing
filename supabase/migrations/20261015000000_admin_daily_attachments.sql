-- Admin Daily Activity: lampiran dokumen ganda + status "Revisi".
-- Status disimpan sebagai text tanpa constraint (opsi divalidasi Zod di
-- lib/constants.ts), jadi "Revisi" tidak butuh perubahan skema.

-- Daftar lampiran: [{ "path": "<tenant>/admin_daily/...", "name": "...", "size": 123 }]
alter table public.admin_daily
  add column if not exists attachments jsonb not null default '[]'::jsonb;

alter table public.admin_daily
  drop constraint if exists admin_daily_attachments_is_array;
alter table public.admin_daily
  add constraint admin_daily_attachments_is_array check (jsonb_typeof(attachments) = 'array');

-- Maks 100 MB per file (sebelumnya 10 MB).
update storage.buckets set file_size_limit = 104857600 where id = 'files';
