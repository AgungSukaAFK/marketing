# TITAN APEX V4 — Industrial & Mining CRM

Versi production dari prototipe `Sales Marketing Web Sudah Jadi.html` (prototipe **tetap disimpan** sebagai referensi).
Rencana lengkap ada di [planning.md](planning.md).

**Stack:** Next.js 16 (App Router, Server Actions) · TypeScript · shadcn/ui + Tailwind v4 · TanStack Table ·
React Hook Form + Zod · Supabase (Postgres + RLS, Auth, Storage, Realtime Presence) · Recharts · SheetJS / jsPDF / docx.

Tema default **gelap dengan aksen hijau** (seperti prototipe), plus **tema terang** — toggle di header.
Aksen (Emerald/Cyan/Indigo/Amber/Rose), font, dan densitas diatur per perusahaan di Settings.

---

## Menjalankan lokal

Prasyarat: Node 20+, Docker, [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
npm install
supabase start                 # Postgres, Auth, Storage, Realtime lokal (+ migration & seed)
cp .env.example .env.local     # lalu isi dari output `supabase status`
npm run dev                    # http://localhost:3000
```

Reset database ke data demo: `supabase db reset`. Email (reset password) lokal bisa dilihat di Mailpit: http://127.0.0.1:54324.

### Akun demo (hanya dari `supabase/seed.sql`)

| Email | Password | Role |
|---|---|---|
| moderator@titan.local | Moderator123! | Moderator (platform) |
| master@titan.local | Master123! | Master — PT Titan Demo |
| admin@titan.local | Admin123! | Admin — PT Titan Demo |
| budi@titan.local / rina@titan.local | Sales123! | Sales — PT Titan Demo |
| pending@titan.local | Pending123! | Baru daftar, menunggu aktivasi |
| other@lain.local | Other123! | Master — PT Tenant Lain (uji isolasi) |

---

## Role & alur akun

```
Register → akun NONAKTIF (tanpa company & role)
        → Moderator: pilih company/tenant + role, edit data → aktif
        → user bisa login
```

| Role | Cakupan |
|---|---|
| **Moderator** | Lintas perusahaan. Kelola company/tenant, aktivasi & edit semua akun. Tidak melihat data operasional. |
| **Master** | Semua data di perusahaannya. Kelola semua akun, batasi menu per akun, backup/restore/reset data. Minimal 1 Master aktif per perusahaan. |
| **Admin** | Semua data di perusahaannya. Kelola akun Sales, Settings tampilan & menu. |
| **Sales** | Hanya data miliknya (atau yang di-assign ke dia lewat kolom Sales). |

Master/Admin juga bisa langsung membuat akun di menu **Akun** (akun dibuat langsung aktif di perusahaannya).

---

## Struktur

```
app/
  (auth)/          login, register, forgot, reset-password
  (app)/           layout (sidebar + header + presence) & 15 modul + custom/[key]
  moderator/       panel moderator (akun & company)
  actions/         server actions: entity (CRUD generik), auth, accounts, moderator, settings
components/
  entity/          EntityPage, EntityForm, useEntityCrud — pola CRUD reusable
  data-table/      DataTable (TanStack: sort, cari, paginasi)
  layout/          sidebar, header, presence-provider (Supabase Realtime)
lib/
  entities.ts      definisi 11 entitas: field form, kolom, nilai turunan, skema Zod
  auth.ts          sesi, guard role/menu, konteks tenant
  menus.ts         logika menu (urutan, visibilitas, role, batasan per akun)
  export.ts        Excel / PDF / Word (.docx)
supabase/
  migrations/      schema + RLS + trigger + storage + realtime policy
  seed.sql         data demo (lokal/staging saja)
```

Menambah modul CRUD baru: tambahkan definisi di `lib/entities.ts` + tabel/RLS di migration baru, lalu buat
`app/(app)/<route>/page.tsx` berisi `loadEntity()` + `<EntityPage>` (lihat `app/(app)/customers/page.tsx`).

---

## Keamanan (perbaikan dari prototipe)

- **RLS Postgres** di semua tabel: isolasi tenant selalu, Sales hanya baris miliknya. `tenant_id` & `owner` diisi DB dari sesi.
  Trigger mencegah memindah baris ke tenant lain dan relasi lintas tenant.
- `profiles` & `tenants` **tidak bisa diubah dari client** — hanya lewat server action yang memeriksa role (service role di server).
- Password via Supabase Auth (tanpa plaintext / security question). Reset lewat email.
- File di **Storage privat** (`files/<tenant_id>/...`), download via signed URL 60 detik.
- Tanpa `dangerouslySetInnerHTML` kecuali konten menu kustom yang **disanitasi DOMPurify**.
- Validasi Zod di client **dan** server. CSP + security headers di `next.config.ts`.
- Realtime presence memakai channel privat `tenant:<id>` yang dibatasi RLS.

---

## Deploy (Supabase cloud + Vercel)

1. Buat project Supabase → `supabase link --project-ref <ref>` → `supabase db push` (seed **tidak** ikut).
2. Supabase Dashboard › Authentication › Providers › Email: **matikan "Confirm email"**.
   Atur Site URL & Redirect URLs ke domain Vercel (`https://<domain>/**`).
3. Realtime › Settings: pastikan **"Allow public access" dimatikan** (agar channel privat wajib otorisasi).
4. Buat moderator pertama: register lewat aplikasi, lalu jalankan di SQL Editor:
   ```sql
   update public.profiles set role = 'moderator', tenant_id = null, active = true
   where email = 'email-anda@domain.com';
   ```
5. Vercel: set env `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## Catatan / keterbatasan

- Rate limit login/register/lupa password masih **in-memory per instance** — untuk Vercel multi-instance ganti dengan
  store bersama (mis. Upstash Redis) di `lib/rate-limit.ts`.
- Import Excel memakai header kolom = nama field (sama dengan hasil Export Excel), maks. 2000 baris.
- Restore JSON menimpa baris ber-ID sama di tenant sendiri; ID milik tenant lain diabaikan.
