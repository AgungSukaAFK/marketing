"use server";

import { revalidatePath } from "next/cache";
import { getAppContext } from "@/lib/auth";
import {
  ENTITIES,
  MAX_IMPORT_ERRORS,
  MAX_IMPORT_ROWS,
  asAttachments,
  fileColumns,
  fileListFields,
  filePathFields,
  importLine,
  rowFilePaths,
  type EntityDef,
  type EntityKey,
  type ImportResult,
} from "@/lib/entities";
import { dbError, fail, ok, type ActionResult } from "@/lib/action-result";
import { logActivity } from "@/lib/activity";
import { PIPELINE_STAGES, STORAGE_BUCKET } from "@/lib/constants";
import { z } from "zod";
import { unstable_rethrow } from "next/navigation";
import { importQuotation } from "./quotation";

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
  const validPath = (p: unknown) =>
    typeof p === "string" && p.startsWith(`${ctx.profile.tenant_id}/${def.table}/`) && !p.includes("..");
  for (const f of filePathFields(def)) {
    const p = data[f];
    if (p == null) {
      delete data[f];
      continue;
    }
    if (!validPath(p)) throw new Error("Path file tidak valid");
  }
  for (const f of fileListFields(def)) {
    if (!asAttachments(data[f]).every((a) => validPath(a.path))) throw new Error("Path file tidak valid");
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
      const replaced = fileColumns(def).filter((f) => f in data);
      let oldPaths: string[] = [];
      if (replaced.length) {
        const { data: old } = await supabase.from(def.table).select(replaced.join(",")).eq("id", id).maybeSingle();
        // file lama yang tidak lagi dipakai baris ini (diganti / dibuang dari daftar lampiran)
        const kept = new Set(rowFilePaths(def, data));
        oldPaths = rowFilePaths(def, old as Record<string, unknown> | null).filter((p) => !kept.has(p));
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
    const { data: rows, error } = await ctx.supabase
      .from(def.table)
      .delete()
      .eq("id", id)
      .select(["id", ...fileColumns(def)].join(","));
    if (error) return fail(dbError(error));
    if (!rows?.length) return fail("Data tidak ditemukan atau tidak berwenang");
    const files = rowFilePaths(def, rows[0] as unknown as Record<string, unknown>);
    if (files.length) await ctx.supabase.storage.from(STORAGE_BUCKET).remove(files);
    revalidatePath(def.href);
    return ok(undefined, "Dihapus");
  } catch (e) {
    unstable_rethrow(e);
    return fail(e instanceof Error ? e.message : "Gagal menghapus");
  }
}

/**
 * Import Excel: kolom = nama field (sama dengan hasil Export Excel / template).
 * `customer_code` → customer_id, `sales` (username) → sales_id, `owner` (username)
 * → pemilik data. Divalidasi Zod per baris; `dryRun` hanya memvalidasi (preview).
 */
export async function importEntity(
  key: string,
  rows: Record<string, unknown>[],
  opts: { dryRun?: boolean } = {},
): Promise<ActionResult<ImportResult>> {
  // quotation: satu baris per barang, digabung per quot_no
  if (key === "quotation") return importQuotation(rows, opts);
  try {
    const { def, ctx, denied } = await guard(key);
    if (denied) return fail("Akses menu ditolak");
    if (!Array.isArray(rows) || rows.length === 0) return fail("File kosong");
    if (rows.length > MAX_IMPORT_ROWS) return fail(`Maksimal ${MAX_IMPORT_ROWS} baris per import`);

    const { supabase } = ctx;
    const needsCustomer = def.fields.some((f) => f.type === "customer");
    const userField = def.fields.find((f) => f.type === "user");
    // RLS insert memaksa owner = pembuat → owner lain di-set lewat update setelah insert,
    // dan hanya Master/Admin yang boleh (sama dengan trigger guard_tenant_owner)
    const hasOwner = def.columns.some((c) => c.key === "owner");
    const manager = ctx.profile.role === "master" || ctx.profile.role === "admin";
    const [custRes, profRes] = await Promise.all([
      needsCustomer ? supabase.from("customers").select("id, customer_code") : Promise.resolve({ data: [] }),
      supabase.from("profiles").select("id, username"),
    ]);
    const custByCode = new Map((custRes.data ?? []).map((c) => [String(c.customer_code).trim(), c.id as string]));
    const userByName = new Map((profRes.data ?? []).map((p) => [String(p.username), p.id as string]));

    const valid: Record<string, unknown>[] = [];
    const reassign = new Map<string, string[]>(); // owner → id baris
    const errors: string[] = [];
    rows.forEach((r, i) => {
      const line = `Baris ${importLine(r, i)}`;
      const rawRow: Record<string, unknown> = {};
      for (const f of def.fields) {
        if (f.type === "file" || f.type === "files") continue;
        if (f.type === "customer") {
          const code = String(r.customer_code ?? "").trim();
          rawRow[f.name] = code ? custByCode.get(code) ?? "__unknown__" : "";
        } else if (f.type === "user") {
          const u = String(r.sales ?? r[f.name] ?? "").trim();
          rawRow[f.name] = u ? userByName.get(u) ?? "__unknown__" : "";
        } else if (f.type === "users") {
          // "budi.santoso, rina" → [id, id]
          const names = String(r[f.name] ?? "").split(",").map((u) => u.trim()).filter(Boolean);
          const unknown = names.filter((u) => !userByName.has(u));
          if (unknown.length) rawRow.__unknownUsers = `${f.name} "${unknown.join(", ")}"`;
          rawRow[f.name] = names.map((u) => userByName.get(u)).filter(Boolean);
        } else {
          rawRow[f.name] = r[f.name] ?? "";
        }
      }
      if (rawRow.customer_id === "__unknown__") return void errors.push(`${line}: customer_code "${r.customer_code}" tidak ditemukan`);
      if (userField && rawRow[userField.name] === "__unknown__") return void errors.push(`${line}: sales "${r.sales}" tidak ditemukan`);
      if (rawRow.__unknownUsers) return void errors.push(`${line}: ${rawRow.__unknownUsers} tidak ditemukan`);
      const ownerName = hasOwner ? String(r.owner ?? "").trim() : "";
      const owner = ownerName ? userByName.get(ownerName) : undefined;
      if (ownerName && !owner) return void errors.push(`${line}: owner "${ownerName}" tidak ditemukan`);
      if (owner && owner !== ctx.profile.id && !manager)
        return void errors.push(`${line}: owner user lain hanya bisa diisi Master/Admin`);
      const parsed = def.schema.safeParse(rawRow);
      if (!parsed.success) return void errors.push(`${line}: ${firstIssue(parsed.error)}`);
      const row = normalize(def, { ...parsed.data, id: crypto.randomUUID() }, ctx);
      if (owner && owner !== ctx.profile.id) reassign.set(owner, [...(reassign.get(owner) ?? []), row.id as string]);
      valid.push(row);
    });

    if (valid.length && !opts.dryRun) {
      const { error } = await supabase.from(def.table).insert(valid);
      if (error) return fail(dbError(error));
      revalidatePath(def.href);
      for (const [owner, ids] of reassign) {
        // dicicil supaya URL filter `id=in.(…)` tidak terlalu panjang
        for (let i = 0; i < ids.length; i += 100) {
          const { error: ownerErr } = await supabase.from(def.table).update({ owner }).in("id", ids.slice(i, i + 100));
          if (ownerErr) return fail(`${valid.length} data sudah masuk, tetapi owner gagal diubah: ${dbError(ownerErr)}`);
        }
      }
      await logActivity({
        action: "import",
        actorId: ctx.profile.id,
        entity: def.table,
        recordId: null,
        label: `${valid.length} data`,
        meta: { inserted: valid.length, skipped: errors.length, rows: rows.length },
      });
    }
    return ok({ inserted: valid.length, skipped: errors.length, errors: errors.slice(0, MAX_IMPORT_ERRORS) });
  } catch (e) {
    unstable_rethrow(e);
    return fail(e instanceof Error ? e.message : "Import gagal");
  }
}

/** Link download lampiran (berlaku 60 detik). Dibuat di server supaya tercatat di Activity History. */
export async function getDownloadUrl(key: string, path: string, name?: string): Promise<ActionResult<string>> {
  try {
    const { def, ctx, denied } = await guard(key);
    if (denied) return fail("Akses menu ditolak");
    if (typeof path !== "string" || !path.startsWith(`${ctx.profile.tenant_id}/`) || path.includes(".."))
      return fail("Path file tidak valid");
    const fileName = typeof name === "string" && name ? name.slice(0, 255) : undefined;
    const { data, error } = await ctx.supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(path, 60, { download: fileName || true });
    if (error || !data) return fail("Gagal membuat link download");

    // baris pemilik lampiran → referensi di Activity History
    let recordId: string | null = null;
    for (const f of filePathFields(def)) {
      const { data: row } = await ctx.supabase.from(def.table).select("id").eq(f, path).limit(1).maybeSingle();
      recordId = (row?.id as string | undefined) ?? null;
      if (recordId) break;
    }
    for (const f of recordId ? [] : fileListFields(def)) {
      // string JSON: array JS diformat supabase-js sebagai array Postgres, bukan jsonb
      const { data: row } = await ctx.supabase
        .from(def.table)
        .select("id")
        .contains(f, JSON.stringify([{ path }]))
        .limit(1)
        .maybeSingle();
      recordId = (row?.id as string | undefined) ?? null;
      if (recordId) break;
    }
    await logActivity({
      action: "download",
      actorId: ctx.profile.id,
      entity: def.table,
      recordId,
      label: fileName ?? path.split("/").pop(),
      meta: { file: fileName ?? path.split("/").pop(), path },
    });
    return ok(data.signedUrl);
  } catch (e) {
    unstable_rethrow(e);
    return fail(e instanceof Error ? e.message : "Gagal membuat link download");
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
