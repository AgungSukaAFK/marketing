-- Helper auth agar register/login tidak butuh service_role key di server.

-- Cek ketersediaan username saat registrasi (dipanggil sebelum login → anon).
create function public.username_available(p_username text) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.profiles where username = lower(trim(p_username)))
$$;
revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

-- Catat waktu login terakhir untuk user yang sedang login saja.
create function public.touch_last_seen() returns void
language sql volatile security definer set search_path = '' as $$
  update public.profiles set last_seen_at = now() where id = auth.uid()
$$;
revoke all on function public.touch_last_seen() from public;
grant execute on function public.touch_last_seen() to authenticated;
