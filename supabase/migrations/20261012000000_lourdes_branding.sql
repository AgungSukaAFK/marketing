-- Restyle mengikuti styling-guide.md (branding "Lourdes Marketing").
-- Default baru untuk tenant baru + migrasi nilai lama. Kode aplikasi juga
-- menormalkan nilai lama (lib/accent-options.ts, lib/font-options.ts), jadi
-- migrasi ini aman dijalankan kapan saja.

alter table public.app_settings alter column app_name set default 'Lourdes Marketing';
alter table public.app_settings alter column accent   set default 'zinc';
alter table public.app_settings alter column font     set default 'geist';

-- Nama bawaan lama ikut diganti; nama yang sudah diubah admin tidak disentuh.
update public.app_settings set app_name = 'Lourdes Marketing' where app_name = 'TITAN APEX V4';

-- Aksen lama ("Emerald", …) → nama tema baru (class .theme-<name>).
update public.app_settings
   set accent = lower(accent)
 where accent in ('Emerald', 'Cyan', 'Indigo', 'Amber', 'Rose');

-- Font lama → daftar font baru (yang tidak ada padanannya kembali ke Geist).
update public.app_settings
   set font = case when font = 'Inter' then 'inter' else 'geist' end
 where font in ('Inter', 'JetBrains Mono', 'Space Grotesk', 'Manrope', 'Outfit');
