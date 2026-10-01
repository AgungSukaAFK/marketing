import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Client service_role — MELEWATI RLS. Hanya untuk server action yang sudah
 * memeriksa role pemanggil (kelola akun, aktivasi moderator). Jangan pernah
 * diimpor dari komponen client.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY belum di-set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
