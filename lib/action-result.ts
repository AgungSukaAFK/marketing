export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };

export const ok = <T>(data?: T, message?: string): ActionResult<T> => ({ ok: true, data, message });
export const fail = (error: string): ActionResult<never> => ({ ok: false, error });

/** Pesan error Postgres/PostgREST yang ramah pengguna */
export function dbError(e: { code?: string; message: string } | null | undefined): string {
  if (!e) return "Terjadi kesalahan";
  if (e.code === "23505") return "Data duplikat (sudah ada)";
  if (e.code === "23503") return "Data masih dipakai / referensi tidak ditemukan";
  if (e.code === "42501") return "Tidak berwenang (ditolak RLS)";
  if (e.code === "23514") return "Nilai tidak valid";
  return e.message;
}
