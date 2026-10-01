import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Client service_role — MELEWATI RLS. Hanya untuk server action yang sudah
 * memeriksa role pemanggil (kelola akun, aktivasi moderator). Jangan pernah
 * diimpor dari komponen client.
 */
export function createAdminClient() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Env wajib & harus ASCII — karakter salin-tempel (mis. "›") memicu error ByteString di header fetch. */
function env(name: string) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`${name} belum di-set`);
  const bad = [...v].findIndex((c) => c.charCodeAt(0) > 127);
  if (bad !== -1) throw new Error(`${name} berisi karakter tidak valid di posisi ${bad} — salin ulang nilainya`);
  return v;
}
