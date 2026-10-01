# Planning — Migrasi TITAN APEX V4 ke Production

Dokumen perencanaan konversi prototipe **TITAN APEX V4 (Industrial & Mining CRM)** dari aplikasi single-file berbasis `localStorage` menjadi web app production dengan **Next.js + shadcn/ui + Supabase**.

> Status: Draft v2 — 2026-10-01
> Sumber kebenaran prototipe: `Sales Marketing Web Sudah Jadi.html`
> Keputusan terkunci: **Auth email tanpa verifikasi** · **Multi-tenant (tenant_id + RLS per tenant)**

---

## 1. Tujuan & Prinsip

**Tujuan:** mengubah prototipe demo (data lokal per-browser, tanpa server) menjadi aplikasi multi-user sungguhan dengan database terpusat, autentikasi aman, dan hak akses yang dipaksakan di server.

**Prinsip migrasi:**
1. **Pertahankan fungsionalitas & UX** yang sudah ada (15 modul, hierarki role, Customer Code sebagai perekat antar-modul).
2. **Pindahkan otorisasi ke server.** Role Master/Admin/Sales tidak boleh lagi hanya dicek di browser — harus dipaksakan lewat Supabase Row Level Security (RLS).
3. **Perbaiki celah keamanan prototipe** sejak awal: XSS (React auto-escape), password plaintext (diganti Supabase Auth), file base64 (diganti Supabase Storage).
4. **Satu pola, banyak modul.** Mayoritas modul adalah CRUD tabel yang mirip — bangun satu pola reusable, lalu replikasi.

**Non-tujuan (fase ini):** mobile app native, integrasi ERP/Accurate, notifikasi email/WA otomatis. Dicatat sebagai backlog.

---

## 2. Tech Stack

| Lapisan | Pilihan | Catatan |
|---|---|---|
| Framework | **Next.js (App Router)** + TypeScript | Server Components + Server Actions |
| UI | **shadcn/ui** + Tailwind CSS | Ganti markup Tailwind manual prototipe |
| Komponen tabel | TanStack Table (via shadcn data-table) | Sorting, filter, pagination |
| Form & validasi | React Hook Form + **Zod** | Zod dipakai juga di server action |
| Database | **Supabase (Postgres)** | + migrations via Supabase CLI |
| Auth | **Supabase Auth** (email/password, **tanpa verifikasi email**) | Ganti sistem login/registrasi prototipe |
| Otorisasi | **Postgres RLS** | Role **dan tenant** diambil dari tabel `profiles` |
| Storage | **Supabase Storage** | Ganti penyimpanan file base64 |
| Realtime | **Supabase Realtime (Presence)** | Ganti heartbeat `setInterval` + widget online |
| Charts | **Recharts** | Ganti Chart.js |
| Export | `xlsx`, `jspdf` + autotable | Tetap client-side, logika dari prototipe dipakai ulang |
| Ikon | **lucide-react** | Sama seperti prototipe |
| Deploy | Vercel (app) + Supabase (DB) | Env via Vercel project settings |

---

## 3. Arsitektur

```
Browser (Next.js client components, shadcn)
        │  Server Actions / Route Handlers
        ▼
Next.js server (RSC)  ──  @supabase/ssr  ──►  Supabase
        │                                      ├─ Postgres + RLS
        │                                      ├─ Auth
        │                                      ├─ Storage (dokumen, foto)
        └──────────────────────────────────────┴─ Realtime (presence)
```

- **Akses data** lewat Supabase client dengan RLS aktif. Hampir semua query bisa langsung dari komponen, karena RLS yang jadi penjaga, bukan kode aplikasi.
- **Operasi sensitif** (ubah role, kelola akun orang lain, reset password) lewat **Server Action** yang mengecek role pemanggil, bila perlu memakai `service_role` secara terkontrol di server saja.
- **Jangan pernah** mengekspos `service_role key` ke client.

---

## 4. Model Data (localStorage → Tabel Supabase)

Prototipe menyimpan 22 key `titan_*`. Pemetaan ke tabel. **Catatan multi-tenant:** setiap tabel operasional & konfigurasi punya kolom **`tenant_id` (FK `tenants.id`)**, dan semua RLS menyaring berdasarkan tenant (lihat §5).

### 4.0 Tenancy (baru — multi-tenant)
| Tabel | Keterangan |
|---|---|
| `tenants` | `id (uuid)`, `name`, `created_at`. Satu baris per perusahaan. |
| `profiles.tenant_id` | Menentukan tenant tiap user. Diisi saat sign-up (lihat §5). |
| semua tabel operasional | Tambah `tenant_id uuid not null` + index. `customer_code` **unik per tenant**, bukan global. |

### 4.1 Identitas & akses
| Prototipe (localStorage) | Tabel Postgres | Keterangan |
|---|---|---|
| `users` | `profiles` | 1:1 dengan `auth.users`. Kolom: `id (uuid, fk auth.users)`, `tenant_id`, `username`, `name`, `role` (enum: `master`/`admin`/`sales`), `active`, `created_at`. **Password & security Q/A dihapus** — ditangani Supabase Auth. |
| `login_history` | `login_history` | `id`, `user_id`, `action` (LOGIN/LOGOUT), `created_at`. Diisi lewat trigger/server action saat sign-in/out. |
| `presence` | — | Diganti **Supabase Realtime Presence**, bukan tabel. |
| `access_control` | `access_control` | `user_id`, `enabled` (bool), `allowed_menus` (text[]). Pembatasan menu per akun. |

### 4.2 Data operasional (semua punya `id uuid`, `owner uuid`, `created_at`)
| Prototipe | Tabel | Field inti |
|---|---|---|
| `customers` | `customers` | `customer_code` (unik, auto `CUST-0001`), `sales`, `pt`, `pic`, `wa`, `email`, `jabatan`, `site`, `cuti`, `ultah`, `tinggal`, `note` |
| `sales_daily` | `sales_daily` | `customer_id`, `type`, `status`, `note`, `absensi`, `attachment_path` |
| `admin_daily` | `admin_daily` | `customer_id`, `type`, `ref_no`, `dokumen`, `status` |
| `pipeline` | `pipeline` | `customer_id`, `sales`, `stage` (8 tahap), `value`, `product`, `prob` |
| `sales_forecast` | `sales_forecast` | `customer_id`, `part_no`, `periode`, `t_qty`, `t_rp`, `actual_qty`, `actual_rp`, `status`, `remarks` |
| `quotation` | `quotation` | `customer_id`, `quot_no`, `part`, `harga`, `qty`, `total`, `margin_p`, `margin_rp`, `po_status`, `loss` |
| `forecast_trend` | `forecast_trend` | `forecast_ref` (fk `sales_forecast`), `smt1_qty`, `smt2_qty`, `actual_2025`, `forecast_2026`, `alasan` |
| `actual_vs_forecast` | `actual_vs_forecast` | `customer_id`, `part_no`, `target_qty`, `actual_qty` |
| `documentation` | `documentation` | `customer_id`, `nama`, `file_path`, `file_name` (file → Storage) |
| `refreshment` | `refreshment` | `tanggal`, `jenis`, `topik`, `durasi`, `peserta`, `nilai`, `ringkasan`, `status` |
| `evaluation` | `evaluation` | `periode`, `sales`, `topik`, `deskripsi`, `skor`, `foto_path`, `tindak`, `status` |

**Catatan relasi:** prototipe memakai `customer_code` sebagai string penghubung. Di DB, pakai **`customer_id` (FK ke `customers.id`)** + simpan `customer_code` denormalized untuk tampilan/export. Field "(auto)" di form (PT, PIC, WA, Site) tidak lagi disimpan ganda bila bisa di-join; untuk kemudahan export, boleh dicache.

### 4.3 Konfigurasi aplikasi
| Prototipe | Tabel | Keterangan |
|---|---|---|
| `app_settings`, `header_cfg` | `app_settings` | **1 baris per tenant** (bukan global). `tenant_id`, `app_name`, `accent`, `font`, `density`, `header_cfg` (jsonb). |
| `menu_labels`, `menu_icons`, `menu_order`, `menu_visibility` | `menu_config` | 1 baris per tenant berisi semua konfigurasi menu (jsonb). |
| `custom_menus` | `custom_menus` | `menu_id`, `label`, `icon`, `content` (HTML SOP). **Wajib disanitasi** saat render (lihat §7). |

### 4.4 Nilai turunan (jangan disimpan — hitung saat query/render)
Pencapaian %, win rate, deviasi, shortage, total pipeline, ringkasan semester evaluasi → **computed** di SQL view atau di layer aplikasi, bukan kolom tersimpan. Prototipe sudah menghitungnya on-the-fly; pertahankan.

---

## 5. Auth & RBAC

**Auth:** Supabase Auth email/password, **tanpa verifikasi email**.
- Di Supabase Auth settings, **matikan "Confirm email"** → user bisa langsung login setelah sign-up tanpa klik link konfirmasi. Email tetap dipakai sebagai identitas login & untuk reset password.
- ⚠️ **Konsekuensi:** kepemilikan email tidak diverifikasi, jadi orang bisa daftar pakai email yang bukan miliknya. Mitigasi: untuk tenant yang sudah jalan, sebaiknya akun **dibuat oleh Admin/Master** (bukan self-service terbuka), atau self-service dibatasi domain email tertentu.
- Username prototipe (mis. `budi.santoso`) → disimpan di `profiles.username` untuk tampilan; login pakai email.
- **Lupa password** → reset password lewat link email Supabase (tetap jalan walau verifikasi dimatikan).

**Multi-tenant & sign-up:**
- Saat registrasi, user harus terhubung ke sebuah tenant. Dua pola yang didukung:
  1. **Buat tenant baru** (user pertama jadi `master` tenant itu) — alur onboarding perusahaan baru.
  2. **Join tenant lewat undangan/kode** dari Admin/Master tenant tsb (role `sales`/`admin`).
- Trigger `on auth.users insert` membuat `profiles` dengan `tenant_id` + `role` sesuai jalur di atas (data dibawa via `user_metadata` saat sign-up).

**Role & aturan (per tenant):**
- `moderator` *(platform, tanpa tenant — lihat §10)*: kelola tenant, aktivasi akun baru (assign tenant + role), edit/nonaktifkan akun mana pun. Tidak melihat data operasional.
- `master`: kelola semua akun **dalam tenant-nya** (ubah role, batasi menu), lihat semua data tenant. Minimal **1 Master aktif per tenant** harus selalu ada (validasi dipertahankan).
- `admin`: kelola akun `sales` dalam tenant, lihat semua data tenant.
- `sales`: hanya lihat/ubah **data miliknya** (`owner = auth.uid()`).

**RLS (pola — selalu saring tenant lebih dulu):**
```sql
-- helpers
create function current_tenant() returns uuid language sql stable security definer as $$
  select tenant_id from profiles where id = auth.uid()
$$;
create function current_role() returns text language sql stable security definer as $$
  select role from profiles where id = auth.uid()
$$;

-- contoh policy untuk tabel operasional
create policy read_scoped on customers for select using (
  tenant_id = current_tenant()
  and (owner = auth.uid() or current_role() in ('admin','master'))
);
create policy insert_scoped on customers for insert with check (
  tenant_id = current_tenant() and owner = auth.uid()
);
create policy update_scoped on customers for update using (
  tenant_id = current_tenant()
  and (owner = auth.uid() or current_role() in ('admin','master'))
);
```
- **Isolasi tenant adalah batas keamanan terpenting:** setiap policy di setiap tabel wajib menyertakan `tenant_id = current_tenant()`. Uji bahwa user tenant A tidak bisa membaca data tenant B lewat API langsung.
- Pembatasan menu per akun (`access_control`) dipaksakan di **UI + guard route**; data tetap aman karena RLS.

---

## 6. Pemetaan Modul & Rute

Satu modul = satu route di `app/(app)/`. Mayoritas memakai komponen `DataTable` + `EntityForm` reusable.

| Menu prototipe | Route | Jenis |
|---|---|---|
| Dashboard | `/dashboard` | KPI cards + 2 chart (Recharts) |
| Customer DB | `/customers` | CRUD tabel + auto customer_code |
| Sales Daily Activity | `/sales-daily` | CRUD + **toggle Board/Table** + aksi "Buat Pipeline" |
| Admin Daily Activity | `/admin-daily` | CRUD tabel |
| Pipeline Engine | `/pipeline` | **Kanban 8 kolom** + KPI (total value, win rate) |
| Sales Forecast | `/forecast` | CRUD + kolom pencapaian % |
| Monitoring Quotation | `/quotation` | CRUD + hitung total & margin otomatis |
| Forecast Trend Analysis | `/forecast-trend` | CRUD + deviasi/ACH % |
| Sales Actual vs Forecast | `/actual` | CRUD + shortage/status |
| Documentation | `/documentation` | Upload/download via Storage |
| Refreshment & Assessment | `/refreshment` | CRUD |
| Evaluasi Bulanan Sales | `/evaluation` | CRUD + ringkasan semester |
| Analytics | `/analytics` | Top sales & top sparepart |
| Akun | `/accounts` | (Master/Admin) daftar akun, online, riwayat login |
| Settings | `/settings` | (Master/Admin) tampilan, menu, custom menu, access control, backup/restore |

**Fitur lintas-modul yang dipertahankan:**
- Import Excel, Export Excel/PDF/Word (logika dari prototipe, **validasi Zod saat import**).
- Autofill dari Customer Code (join, bukan copy manual).
- Toolbar seragam (Tambah / Import / Export).

---

## 7. Keamanan (perbaikan dari prototipe)

| Celah di prototipe | Solusi di versi production |
|---|---|
| **Stored XSS** (data user masuk mentah ke `innerHTML`) | React meng-escape teks otomatis. **Tidak ada `dangerouslySetInnerHTML`** kecuali untuk `custom_menus.content`, yang **wajib** disanitasi dengan DOMPurify. |
| **Password plaintext** di localStorage | Dihapus total — Supabase Auth (hashing bcrypt/scrypt di server). |
| **Otorisasi hanya di client** | Dipaksakan via RLS Postgres (role **+ isolasi tenant**). |
| **File base64 di localStorage** | Supabase Storage + signed URL. |
| Security Q/A sebagai reset password | Reset via email Supabase. |
| Tanpa audit | `login_history` + (opsional) kolom `updated_by`/`updated_at`. |

Tambahan: CSP header, rate limiting pada server action auth, validasi input Zod di **server** (bukan hanya client).

> ⚠️ **Catatan verifikasi email dimatikan:** karena "Confirm email" nonaktif, email pendaftar tidak dibuktikan kepemilikannya. Untuk mengurangi penyalahgunaan, batasi pembuatan akun (via undangan Admin/Master atau whitelist domain) dan pertimbangkan rate-limit pada sign-up. Verifikasi bisa diaktifkan kembali nanti tanpa mengubah schema.

---

## 8. Struktur Project (usulan)

```
app/
  (auth)/login, /register, /forgot
  (app)/
    layout.tsx            # sidebar + header + guard
    dashboard/page.tsx
    customers/page.tsx
    ... (per modul)
  api/ (route handlers bila perlu)
components/
  ui/                     # shadcn
  data-table/             # tabel reusable
  forms/                  # EntityForm + field dari schema
  layout/sidebar.tsx, header.tsx, presence-widget.tsx
lib/
  supabase/{client,server,middleware}.ts
  schemas/                # Zod per entitas
  export.ts               # excel/pdf/word
  rbac.ts                 # helper role & menu
supabase/
  migrations/             # SQL schema + RLS + seed
  seed.sql                # data dummy (dari prototipe)
```

---

## 9. Rencana Bertahap (Milestones)

**Fase 0 — Setup (±0.5 hari)**
Init Next.js + TS + Tailwind, pasang shadcn, buat project Supabase, konfigurasi `@supabase/ssr` + middleware session, env.

**Fase 1 — Database & RLS (±1–2 hari)**
Tulis migrations: semua tabel §4, enum role & stage, FK, trigger auto `profiles` + `customer_code`, policy RLS semua tabel, `seed.sql` dari data dummy prototipe.

**Fase 2 — Auth & Shell (±1–2 hari)**
Login/register/forgot, trigger profil, layout sidebar+header dengan menu dinamis (order/label/icon/visibility + access_control), route guard per role.

**Fase 3 — Pola CRUD inti (±2 hari)**
Bangun `DataTable` + `EntityForm` reusable + skema Zod. Implementasi **Customer DB** sebagai referensi lengkap (termasuk auto code, import/export).

**Fase 4 — Replikasi modul (±3–4 hari)**
Admin Daily, Sales Forecast, Quotation (hitung total/margin), Forecast Trend, Actual vs Forecast, Refreshment, Evaluation (+ringkasan semester). Autofill via Customer Code.

**Fase 5 — Modul khusus (±2–3 hari)**
Pipeline Kanban, Sales Daily (Board/Table + Buat Pipeline), Documentation (Storage), Dashboard & Analytics (Recharts).

**Fase 6 — Admin & Settings (±2 hari)**
Akun (daftar/online/riwayat), Settings (tampilan, menu config, custom menu + DOMPurify, access control, backup/restore JSON).

**Fase 7 — Realtime & polish (±1 hari)**
Presence online via Supabase Realtime, toast, loading/empty states, responsif.

**Fase 8 — Hardening & deploy (±1–2 hari)**
Audit RLS, uji per role, CSP, deploy Vercel + Supabase, smoke test.

> Estimasi kasar total: ±2–3 minggu kerja 1 developer. Fase bisa diparalelkan setelah Fase 3.

---

## 10. Risiko & Keputusan Terbuka

**Sudah diputuskan:**
- ✅ **Login pakai email, tanpa verifikasi email** ("Confirm email" dimatikan).
- ✅ **Multi-tenant** — setiap tabel pakai `tenant_id`, RLS per tenant, Master/Admin/Sales scoped per tenant.
- ✅ **Onboarding & join tenant (2026-10-01)** — user register → akun **nonaktif** tanpa tenant/role → role baru
  **`moderator`** (platform, lintas-tenant) mengaktifkan dengan meng-assign company/tenant + role (+ edit data) → user bisa login.
  Moderator juga satu-satunya yang membuat tenant. Master/Admin tetap bisa membuat akun langsung di tenant-nya.
  Karena aktivasi manual oleh moderator, whitelist domain email tidak diperlukan untuk saat ini.
- ✅ **Data dummy** — hanya di `supabase/seed.sql` (lokal/staging), tidak ikut migration production.
- ✅ **Export Word** — `.docx` beneran (library `docx`).
- ✅ **Riwayat login** — tabel custom `login_history`.
- ✅ **Tema** — default gelap aksen hijau (seperti prototipe) + tema terang; mode terang/gelap disimpan per user
  (browser), aksen/font/densitas per tenant (`app_settings`).

**Masih perlu diputuskan:**
| Topik | Pertanyaan |
|---|---|
| Rate limit production | Rate limit auth saat ini in-memory per instance — pakai Upstash Redis / store lain saat deploy multi-instance? |

---

## 11. Definition of Done

- [ ] Semua 15 modul berfungsi dengan data dari Supabase.
- [ ] Role Master/Admin/Sales dipaksakan oleh RLS (diuji: Sales tidak bisa baca data Sales lain lewat API langsung).
- [ ] **Isolasi tenant teruji:** user tenant A tidak bisa mengakses data tenant B lewat API langsung.
- [ ] Tidak ada password plaintext; auth lewat Supabase.
- [ ] Tidak ada XSS (custom menu disanitasi; sisanya auto-escape React).
- [ ] File tersimpan di Storage, bukan base64.
- [ ] Import/Export Excel/PDF/Word jalan.
- [ ] Backup/Restore & Reset berfungsi untuk Master.
- [ ] Presence online real-time antar perangkat berbeda.
- [ ] Deployed & smoke-tested di Vercel + Supabase.
```
