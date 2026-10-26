"use server";

import { z } from "zod";
import { getAppContext, requireModerator } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { dbError, fail, ok, type ActionResult } from "@/lib/action-result";
import { logActivity } from "@/lib/activity";
import { ACTIVITY_COLUMNS, actionsForFilter, entityLabel, type ActivityRow } from "@/lib/activity-meta";
import { presentDetail, type ActivityDetail, type ChangeRow } from "@/lib/activity-present";
import { ENTITIES } from "@/lib/entities";
import { run } from "@/lib/safe-action";

const PAGE_SIZE = 50;
/** Rincian perubahan yang dimuat per aksi (import/restore besar bisa ribuan). */
const MAX_CHANGES = 300;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid");

/** Tanggal WIB → batas waktu: awal hari itu (00:00 WIB). */
const wibStart = (d: string) => `${d}T00:00:00+07:00`;
const nextDay = (d: string) => {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
};

/** Error PostgREST bila migration activity_log belum dijalankan. */
const notMigrated = (e: { code?: string } | null) =>
  e?.code === "42P01" || e?.code === "PGRST205" ? "Tabel activity_log belum dibuat — jalankan migration" : null;

const filterSchema = z.object({
  page: z.number().int().min(1).max(100_000).default(1),
  actor: z.guid().nullish(),
  /** "none" = tanpa company (moderator / akun belum aktif) */
  tenant: z.union([z.guid(), z.literal("none")]).nullish(),
  action: z.string().max(40).nullish(),
  entity: z.string().max(40).nullish(),
  from: isoDate.nullish(),
  to: isoDate.nullish(),
  q: z.string().trim().max(100).nullish(),
  /** riwayat satu data */
  record: z.object({ entity: z.string().regex(/^[a-z_]{2,40}$/), id: z.string().regex(/^[0-9a-z:_-]{1,80}$/i) }).nullish(),
});

export type ActivityFilter = z.input<typeof filterSchema>;

export async function listActivity(raw: ActivityFilter): Promise<ActionResult<{ rows: ActivityRow[]; total: number; pageSize: number }>> {
  return run(async () => {
    const { supabase } = await requireModerator();
    const parsed = filterSchema.safeParse(raw);
    if (!parsed.success) return fail("Filter tidak valid");
    const f = parsed.data;

    // RLS: hanya moderator yang bisa membaca activity_log
    let q = supabase.from("activity_log").select(ACTIVITY_COLUMNS, { count: "exact" });
    if (f.actor) q = q.eq("actor_id", f.actor);
    if (f.tenant === "none") q = q.is("tenant_id", null);
    else if (f.tenant) q = q.eq("tenant_id", f.tenant);
    if (f.action) {
      const actions = actionsForFilter(f.action);
      if (!actions.length) return fail("Filter aksi tidak dikenal");
      q = q.in("action", actions);
    }
    if (f.entity) q = q.eq("entity", f.entity);
    if (f.from) q = q.gte("created_at", wibStart(f.from));
    if (f.to) q = q.lt("created_at", wibStart(nextDay(f.to)));
    if (f.q) {
      // karakter pemisah filter PostgREST dibuang; nilai dikutip
      const s = f.q.replace(/[",()\\*]/g, " ").trim();
      if (s)
        q = q.or(
          ["label", "actor_name", "actor_username", "ip", "record_id"].map((c) => `${c}.ilike."*${s}*"`).join(","),
        );
    }
    if (f.record) {
      // aksi yang menyentuh data ini, termasuk sebagai data terkait
      const { data: hits } = await supabase
        .from("activity_changes")
        .select("activity_id")
        .eq("entity", f.record.entity)
        .eq("record_id", f.record.id)
        .order("id", { ascending: false })
        .limit(300);
      const ids = [...new Set((hits ?? []).map((h) => h.activity_id as number))];
      const own = `and(entity.eq.${f.record.entity},record_id.eq."${f.record.id}")`;
      q = q.or(ids.length ? `${own},id.in.(${ids.join(",")})` : own);
    }

    const from = (f.page - 1) * PAGE_SIZE;
    const { data, count, error } = await q
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) return fail(notMigrated(error) ?? dbError(error));
    return ok({ rows: (data ?? []) as unknown as ActivityRow[], total: count ?? 0, pageSize: PAGE_SIZE });
  }, "Gagal memuat activity history");
}

export async function getActivityDetail(id: number): Promise<ActionResult<ActivityDetail>> {
  return run(async () => {
    const { supabase } = await requireModerator();
    if (!Number.isSafeInteger(id) || id < 1) return fail("Log tidak valid");
    const [log, changes] = await Promise.all([
      supabase.from("activity_log").select(ACTIVITY_COLUMNS).eq("id", id).maybeSingle(),
      supabase
        .from("activity_changes")
        .select("id, entity, op, record_id, label, fields, old_data, new_data", { count: "exact" })
        .eq("activity_id", id)
        .order("id")
        .limit(MAX_CHANGES),
    ]);
    if (log.error || changes.error) return fail(dbError(log.error ?? changes.error));
    if (!log.data) return fail("Log tidak ditemukan (mungkin sudah dihapus)");
    // nama customer / sales / company di balik id — data tenant tidak terbaca RLS moderator
    const detail = await presentDetail(
      createAdminClient(),
      log.data as unknown as ActivityRow,
      (changes.data ?? []) as ChangeRow[],
      changes.count ?? 0,
    );
    return ok(detail);
  }, "Gagal memuat detail");
}

/** `from` kosong = sejak log pertama. */
const periodSchema = z
  .object({ from: isoDate.nullish(), to: isoDate })
  .refine((p) => !p.from || p.from <= p.to, "Tanggal awal harus sebelum tanggal akhir");
const EPOCH = "2000-01-01";

/** Jumlah log pada periode (pratinjau sebelum dihapus). */
export async function countActivity(raw: z.input<typeof periodSchema>): Promise<ActionResult<number>> {
  return run(async () => {
    const { supabase } = await requireModerator();
    const parsed = periodSchema.safeParse(raw);
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const { from, to } = parsed.data;
    const { count, error } = await supabase
      .from("activity_log")
      .select("id", { count: "exact", head: true })
      .gte("created_at", wibStart(from ?? EPOCH))
      .lt("created_at", wibStart(nextDay(to)));
    if (error) return fail(notMigrated(error) ?? dbError(error));
    return ok(count ?? 0);
  });
}

/** Hapus permanen log pada periode (tanggal WIB, inklusif). Penghapusannya sendiri tercatat. */
export async function purgeActivity(raw: z.input<typeof periodSchema>): Promise<ActionResult<number>> {
  return run(async () => {
    const { supabase } = await requireModerator();
    const parsed = periodSchema.safeParse(raw);
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const { from, to } = parsed.data;
    const { data, error } = await supabase.rpc("purge_activity_log", {
      p_from: wibStart(from ?? EPOCH),
      p_to: wibStart(nextDay(to)),
    });
    if (error) return fail(notMigrated(error) ?? dbError(error));
    return ok(data as number, `${data} log dihapus`);
  });
}

// ---------------------------------------------------------------------------
// Event dari browser — export dibuat di client (lib/export.ts)
// ---------------------------------------------------------------------------
const exportSchema = z.object({
  /** EntityKey, atau "insights" untuk tabel rincian Dashboard/Analytics */
  entity: z.string().refine((v) => v === "insights" || Object.hasOwn(ENTITIES, v), "Modul tidak dikenal"),
  format: z.enum(["excel", "pdf", "word"]),
  count: z.number().int().min(0).max(1_000_000),
  title: z.string().trim().max(200).optional(),
});

export async function logExport(raw: z.input<typeof exportSchema>): Promise<ActionResult> {
  return run(async () => {
    const parsed = exportSchema.safeParse(raw);
    if (!parsed.success) return fail("Data tidak valid");
    const { entity, format, count, title } = parsed.data;
    const { profile } = await getAppContext();
    await logActivity({
      action: "export",
      actorId: profile.id,
      entity,
      label: title || entityLabel(entity),
      meta: { format, count, ...(title && { title }) },
    });
    return ok();
  });
}
