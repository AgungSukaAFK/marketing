-- =============================================================================
-- Seed LOKAL/STAGING saja (dijalankan oleh `supabase db reset`).
-- Jangan dipakai di production.
--
-- Akun demo (login pakai email):
--   moderator@titan.local / Moderator123!  (moderator platform)
--   master@titan.local    / Master123!     (Master  - PT Titan Demo)
--   admin@titan.local     / Admin123!      (Admin   - PT Titan Demo)
--   budi@titan.local      / Sales123!      (Sales   - PT Titan Demo)
--   rina@titan.local      / Sales123!      (Sales   - PT Titan Demo)
--   pending@titan.local   / Pending123!    (baru daftar, menunggu aktivasi)
--   other@lain.local      / Other123!      (Master  - PT Tenant Lain, uji isolasi)
-- =============================================================================

-- Tenant
insert into public.tenants (id, name, code) values
  ('11111111-1111-1111-1111-111111111111', 'PT Titan Demo', 'TITAN'),
  ('22222222-2222-2222-2222-222222222222', 'PT Tenant Lain', 'LAIN');

-- Auth users (trigger handle_new_user membuat profiles)
do $$
declare
  u record;
begin
  for u in
    select * from (values
      ('00000000-0000-0000-0000-00000000000a'::uuid, 'moderator@titan.local', 'Moderator123!', 'moderator',      'Platform Moderator'),
      ('00000000-0000-0000-0000-000000000001'::uuid, 'master@titan.local',    'Master123!',    'master',         'Master Control'),
      ('00000000-0000-0000-0000-000000000002'::uuid, 'admin@titan.local',     'Admin123!',     'admin',          'Administrator'),
      ('00000000-0000-0000-0000-000000000003'::uuid, 'budi@titan.local',      'Sales123!',     'budi.santoso',   'Budi Santoso'),
      ('00000000-0000-0000-0000-000000000004'::uuid, 'rina@titan.local',      'Sales123!',     'rina.wulandari', 'Rina Wulandari'),
      ('00000000-0000-0000-0000-000000000005'::uuid, 'pending@titan.local',   'Pending123!',   'andi.baru',      'Andi Pendaftar Baru'),
      ('00000000-0000-0000-0000-000000000009'::uuid, 'other@lain.local',      'Other123!',     'other.master',   'Master Tenant Lain')
    ) as t(id, email, pass, username, name)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      extensions.crypt(u.pass, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('username', u.username, 'name', u.name),
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), u.id, u.id::text,
      jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
      'email', now(), now(), now()
    );
  end loop;
end $$;

-- Aktivasi (yang di production dilakukan moderator lewat UI)
update public.profiles set role = 'moderator', active = true
 where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set tenant_id = '11111111-1111-1111-1111-111111111111', role = 'master', active = true
 where id = '00000000-0000-0000-0000-000000000001';
update public.profiles set tenant_id = '11111111-1111-1111-1111-111111111111', role = 'admin', active = true
 where id = '00000000-0000-0000-0000-000000000002';
update public.profiles set tenant_id = '11111111-1111-1111-1111-111111111111', role = 'sales', active = true
 where id in ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004');
update public.profiles set tenant_id = '22222222-2222-2222-2222-222222222222', role = 'master', active = true
 where id = '00000000-0000-0000-0000-000000000009';

-- Data dummy (diambil dari prototipe)
do $$
declare
  t      uuid := '11111111-1111-1111-1111-111111111111';
  adm    uuid := '00000000-0000-0000-0000-000000000002';
  budi   uuid := '00000000-0000-0000-0000-000000000003';
  rina   uuid := '00000000-0000-0000-0000-000000000004';
  c1     uuid := 'c0000000-0000-0000-0000-000000000001';
  c2     uuid := 'c0000000-0000-0000-0000-000000000002';
  fc1    uuid := 'f0000000-0000-0000-0000-000000000001';
begin
  insert into public.customers (id, tenant_id, owner, customer_code, sales_id, pt, pic, wa, email, jabatan, site, cuti, ultah, tinggal, note) values
    (c1, t, adm, 'CUST-0001', budi, 'PT Kaltim Prima Coal', 'Andi Wijaya', '081234567890', 'andi@kpc.co.id', 'Procurement Mgr', 'Sangatta', '-', '12 Mar', 'Balikpapan', 'MCCB annual'),
    (c2, t, adm, 'CUST-0002', rina, 'PT Adaro Indonesia',   'Siti Rahma',  '082345678901', 'siti@adaro.com', 'Maintenance Sup', 'Tanjung',  '-', '05 Jul', 'Banjarmasin', 'Conveyor focus');

  insert into public.sales_daily (tenant_id, owner, customer_id, type, status, note, absensi) values
    (t, budi, c1, 'Visit', 'Completed', 'Presentasi MCCB 400A', '08:00'),
    (t, rina, c2, 'Call',  'Pending',   'Follow up roller',     '-');

  insert into public.admin_daily (tenant_id, owner, customer_id, type, ref_no, dokumen, status) values
    (t, adm, c1, 'PO Input', 'PO/KPC/001', 'PO MCCB', 'Proses');

  insert into public.pipeline (tenant_id, owner, customer_id, sales_id, stage, value, product, prob) values
    (t, budi, c1, budi, 'Market Map',  250000000, 'MCCB 400A',   10),
    (t, rina, c2, rina, 'Negotiation', 480000000, 'Roller HDPE', 70);

  insert into public.sales_forecast (id, tenant_id, owner, customer_id, sales_id, part_no, deskripsi, periode, t_qty, t_rp, actual_qty, actual_rp, status, remarks) values
    (fc1, t, budi, c1, budi, 'MCCB-400A-SCH', 'MCCB 400A',   '2026-09', 20,  200000000, 12,  120000000, 'On Track', 'Partial'),
    (default, t, rina, c2, rina, 'RLR-HDPE-89', 'Roller 89mm', '2026-09', 100, 350000000, 100, 350000000, 'Achieved', 'Closed');

  insert into public.quotation (tenant_id, owner, customer_id, quot_no, tgl_quot, tgl_exp, part, harga, qty, margin_p, po_status, loss, remarks) values
    (t, budi, c1, 'QT-2026-001', '2026-08-01', '2026-09-01', 'MCCB 400A', 10000000, 20, 15, 'Pending', 0, 'Waiting');

  insert into public.forecast_trend (tenant_id, owner, forecast_ref, smt1_qty, smt2_qty, actual_2025, forecast_2026, alasan) values
    (t, budi, fc1, 50, 70, 60, 120, 'Crusher line');

  insert into public.actual_vs_forecast (tenant_id, owner, customer_id, part_no, target_qty, actual_qty) values
    (t, budi, c1, 'MCCB-400A-SCH', 20, 12);

  insert into public.documentation (tenant_id, owner, customer_id, nama, file_name) values
    (t, budi, c1, 'Datasheet MCCB.pdf', null);

  insert into public.refreshment (tenant_id, owner, tanggal, jenis, topik, durasi, peserta, nilai, ringkasan, status) values
    (t, adm, '2026-08-20', 'Weekly Brainstorming', 'MCCB Knowledge', 30, 'budi.santoso', '-', 'Trip curve', 'Selesai');

  insert into public.evaluation (tenant_id, owner, periode, sales_id, topik, deskripsi, skor, tindak, status) values
    (t, adm, '2026-08', budi, 'Visit Rate', 'Kunjungan -20%', 75, 'Tingkatkan jadwal', 'In Progress');

  insert into public.custom_menus (tenant_id, menu_key, label, icon, content) values
    (t, 'sop', 'SOP Kunjungan', 'book-open',
     '<h2>SOP Kunjungan Site</h2><ol><li>Konfirmasi jadwal H-1 ke PIC.</li><li>Bawa APD lengkap.</li><li>Isi Sales Daily Activity setelah kunjungan.</li></ol>');

  insert into public.login_history (tenant_id, user_id, action, created_at) values
    (t, budi, 'LOGIN',  now() - interval '2 hours'),
    (t, budi, 'LOGOUT', now() - interval '1 hour');

  -- Data tenant lain (harus TIDAK terlihat oleh user PT Titan Demo)
  insert into public.customers (tenant_id, owner, customer_code, pt, pic, site)
  values ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000009', 'CUST-0001', 'PT Rahasia Tenant Lain', 'Rahasia', 'Jakarta');
end $$;
