"use server";

import { getAppContext } from "@/lib/auth";
import { dbError, fail, ok, type ActionResult } from "@/lib/action-result";
import { run } from "@/lib/safe-action";
import { analyticsPrefsSchema, dashboardPrefsSchema, type PrefKey } from "@/lib/prefs";
import { drillRequestSchema, type DrillResult } from "@/lib/insights/drill";
import { runDrill } from "@/lib/insights/drill-server";

const PREF_SCHEMAS = { dashboard: dashboardPrefsSchema, analytics: analyticsPrefsSchema } as const;

/** Simpan layout Dashboard/Analytics milik user sendiri (RLS: user_id = auth.uid()). */
export async function savePreferences(key: PrefKey, value: unknown): Promise<ActionResult> {
  return run(async () => {
    const schema = PREF_SCHEMAS[key];
    if (!schema) return fail("Preferensi tidak dikenal");
    const parsed = schema.safeParse(value);
    if (!parsed.success) return fail("Preferensi tidak valid");
    const { supabase, profile } = await getAppContext();
    const { error } = await supabase
      .from("user_preferences")
      .upsert({ user_id: profile.id, key, value: parsed.data }, { onConflict: "user_id,key" });
    if (error) {
      // tabel belum dimigrasi (42P01 / PGRST205)
      if (error.code === "42P01" || error.code === "PGRST205") return fail("Tabel user_preferences belum dibuat — jalankan migration");
      return fail(dbError(error));
    }
    return ok(undefined, "Tampilan disimpan");
  });
}

/** Baris data di balik angka Dashboard/Analytics. Data dibatasi RLS seperti modul aslinya. */
export async function loadDrill(raw: unknown): Promise<ActionResult<DrillResult>> {
  return run(async () => {
    const parsed = drillRequestSchema.safeParse(raw);
    if (!parsed.success) return fail("Permintaan tidak valid");
    const { supabase, profile, menus } = await getAppContext();
    if (!menus.some((m) => m.id === "dashboard" || m.id === "analytics")) return fail("Tidak berwenang");
    // Sales selalu melihat datanya sendiri (RLS); filter Sales hanya untuk Master/Admin
    const req = { ...parsed.data, sales: profile.role === "sales" ? null : (parsed.data.sales ?? null) };
    return ok(await runDrill(supabase, req));
  }, "Gagal memuat data");
}
