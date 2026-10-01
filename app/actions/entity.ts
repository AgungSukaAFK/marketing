"use server";

import { revalidatePath } from "next/cache";
import { getAppContext } from "@/lib/auth";
import { ENTITIES, filePathFields, type EntityDef, type EntityKey } from "@/lib/entities";
import { dbError, fail, ok, type ActionResult } from "@/lib/action-result";
import { PIPELINE_STAGES, STORAGE_BUCKET } from "@/lib/constants";
import { z } from "zod";
import { unstable_rethrow } from "next/navigation";

const MAX_IMPORT_ROWS = 2000;

async function guard(key: string) {
  if (!Object.hasOwn(ENTITIES, key)) throw new Error("Entitas tidak dikenal");
  const def = ENTITIES[key as EntityKey];
  const ctx = await getAppContext();
  // Guard menu (UI). Data tetap dijaga RLS di DB.
  if (!ctx.menus.some((m) => m.id === def.menuId)) return { def, ctx, denied: true as const };
  return { def, ctx, denied: false as const };
}

function firstIssue(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const i = error.issues[0];
  return i ? `${i.path.join(".") || "data"}: ${i.message}` : "Data tidak valid";
}

/** Sales tidak bisa meng-assign data ke sales lain; path file harus milik tenant. */
function normalize(def: EntityDef, data: Record<string, unknown>, ctx: Awaited<ReturnType<typeof getAppContext>>) {
  if (ctx.profile.role === "sales" && "sales_id" in data) data.sales_id = ctx.profile.id;
  for (const f of filePathFields(def)) {
    const p = data[f];
    if (p == null) {
      delete data[f];
      continue;
    }
    if (typeof p !== "string" || !p.startsWith(`${ctx.profile.tenant_id}/${def.table}/`) || p.includes("..")) {
      throw new Error("Path file tidak valid");
    }
  }
  return data;
}

export async function saveEntity(key: string, id: string | null, raw: unknown): Promise<ActionResult> {
  try {
    const { def, ctx, denied } = await guard(key);
    if (denied) return fail("Akses menu ditolak");
    const parsed = def.schema.safeParse(raw);
    if (!parsed.success) return fail(firstIssue(parsed.error));
    const data = normalize(def, { ...parsed.data }, ctx);

    // Hapus nama file bila path tidak dikirim (tidak ganti file)
    for (const f of def.fields) {
      if (f.type === "file" && f.nameField && !(f.pathField! in data)) delete data[f.nameField];
    }

    const { supabase } = ctx;
    if (id) {
      const replaced = filePathFields(def).filter((f) => f in data);
      let oldPaths: string[] = [];
      if (replaced.length) {
        const { data: old } = await supabase.from(def.table).select(replaced.join(",")).eq("id", id).maybeSingle();
        oldPaths = replaced.map((f) => (old as Record<string, string | null> | null)?.[f]).filter((p): p is string => !!p);
      }
      const { data: rows, error } = await supabase.from(def.table).update(data).eq("id", id).select("id");
      if (error) return fail(dbError(error));
      if (!rows?.length) return fail("Data tidak ditemukan atau tidak berwenang");
      if (oldPaths.length) await supabase.storage.from(STORAGE_BUCKET).remove(oldPaths);
    } else {
      const { error } = await supabase.from(def.table).insert(data);
      if (error) return fail(dbError(error));
    }
    revalidatePath(def.href);
    return ok(undefined, "Disimpan");
  } catch (e) {
    unstable_rethrow(e);
    return fail(e instanceof Error ? e.message : "Gagal menyimpan");
  }
}

export async function deleteEntity(key: string, id: string): Promise<ActionResult> {
  try {
    const { def, ctx, denied } = await guard(key);
    if (denied) return fail("Akses menu ditolak");
    const paths = filePathFields(def);
    const { data: rows, error } = await ctx.supabase
      .from(def.table)
      .delete()
      .eq("id", id)
      .select(["id", ...paths].join(","));
    if (error) return fail(dbError(error));
    if (!rows?.length) return fail("Data tidak ditemukan atau tidak berwenang");
    const files = paths
      .map((p) => (rows[0] as unknown as Record<string, string | null>)[p])
      .filter((p): p is string => !!p);
    if (files.length) await ctx.supabase.storage.from(STORAGE_BUCKET).remove(files);
    revalidatePath(def.href);
    return ok(undefined, "Dihapus");
  } catch (e) {
    unstable_rethrow(e);
    return fail(e instanceof Error ? e.message : "Gagal menghapus");
  }
}

/**
 * Import Excel: kolom = nama field (sama dengan hasil Export Excel).
 * `customer_code` → customer_id, `sales` (username) → sales_id. Divalidasi Zod per baris.
 */
export async function importEntity(
  key: string,
  rows: Record<string, unknown>[],
): Promise<ActionResult<{ inserted: number; errors: string[] }>> {
  try {
    const { def, ctx, denied } = await guard(key);
    if (denied) return fail("Akses menu ditolak");
    if (!Array.isArray(rows) || rows.length === 0) return fail("File kosong");
    if (rows.length > MAX_IMPORT_ROWS) return fail(`Maksimal ${MAX_IMPORT_ROWS} baris per import`);

    const { supabase } = ctx;
    const needsCustomer = def.fields.some((f) => f.type === "customer");
    const userField = def.fields.find((f) => f.type === "user");
    const [custRes, profRes] = await Promise.all([
      needsCustomer ? supabase.from("customers").select("id, customer_code") : Promise.resolve({ data: [] }),
      supabase.from("profiles").select("id, username"),
    ]);
    const custByCode = new Map((custRes.data ?? []).map((c) => [String(c.customer_code).trim(), c.id as string]));
    const userByName = new Map((profRes.data ?? []).map((p) => [String(p.username), p.id as string]));

    const valid: Record<string, unknown>[] = [];
    const errors: string[] = [];
    rows.forEach((r, i) => {
      const rawRow: Record<string, unknown> = {};
      for (const f of def.fields) {
        if (f.type === "file") continue;
        if (f.type === "customer") {
          const code = String(r.customer_code ?? "").trim();
          rawRow[f.name] = code ? custByCode.get(code) ?? "__unknown__" : "";
        } else if (f.type === "user") {
          const u = String(r.sales ?? r[f.name] ?? "").trim();
          rawRow[f.name] = u ? userByName.get(u) ?? "__unknown__" : "";
        } else {
          rawRow[f.name] = r[f.name] ?? "";
        }
      }
      if (rawRow.customer_id === "__unknown__") return void errors.push(`Baris ${i + 2}: customer_code "${r.customer_code}" tidak ditemukan`);
      if (userField && rawRow[userField.name] === "__unknown__") return void errors.push(`Baris ${i + 2}: sales "${r.sales}" tidak ditemukan`);
      const parsed = def.schema.safeParse(rawRow);
      if (!parsed.success) return void errors.push(`Baris ${i + 2}: ${firstIssue(parsed.error)}`);
      valid.push(normalize(def, { ...parsed.data }, ctx));
    });

    if (valid.length) {
      const { error } = await supabase.from(def.table).insert(valid);
      if (error) return fail(dbError(error));
    }
    revalidatePath(def.href);
    return ok({ inserted: valid.length, errors: errors.slice(0, 20) });
  } catch (e) {
    unstable_rethrow(e);
    return fail(e instanceof Error ? e.message : "Import gagal");
  }
}

/** "Buat Pipeline" dari aktivitas Sales Daily (seperti prototipe). */
export async function createPipelineFromActivity(activityId: string): Promise<ActionResult> {
  const ctx = await getAppContext();
  if (!ctx.menus.some((m) => m.id === "pipeline")) return fail("Akses Pipeline ditolak");
  const { data: act, error } = await ctx.supabase
    .from("sales_daily")
    .select("customer_id, owner, note")
    .eq("id", activityId)
    .single();
  if (error || !act) return fail("Aktivitas tidak ditemukan");
  const { error: insErr } = await ctx.supabase.from("pipeline").insert({
    customer_id: act.customer_id,
    sales_id: act.owner,
    stage: "Market Map",
    value: 100000000,
    product: (act.note ?? "").slice(0, 30) || null,
    prob: 10,
  });
  if (insErr) return fail(dbError(insErr));
  revalidatePath("/pipeline");
  return ok(undefined, "Pipeline dibuat");
}

export async function movePipelineStage(id: string, stage: string): Promise<ActionResult> {
  const ctx = await getAppContext();
  if (!ctx.menus.some((m) => m.id === "pipeline")) return fail("Akses menu ditolak");
  const parsed = z.enum(PIPELINE_STAGES).safeParse(stage);
  if (!parsed.success) return fail("Stage tidak valid");
  const { data, error } = await ctx.supabase.from("pipeline").update({ stage }).eq("id", id).select("id");
  if (error) return fail(dbError(error));
  if (!data?.length) return fail("Tidak berwenang");
  revalidatePath("/pipeline");
  return ok();
}
