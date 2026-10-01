"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAppContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { dbError, fail, ok, type ActionResult } from "@/lib/action-result";
import { run } from "@/lib/safe-action";
import { ACCENTS, BASE_MENUS, FONTS, MENU_ICONS, STORAGE_BUCKET } from "@/lib/constants";
import { ENTITIES, filePathFields, type EntityKey } from "@/lib/entities";

async function managerCtx() {
  const ctx = await getAppContext();
  if (ctx.profile.role !== "master" && ctx.profile.role !== "admin") throw new Error("Hanya Master/Admin");
  return ctx;
}

async function masterCtx() {
  const ctx = await getAppContext();
  if (ctx.profile.role !== "master") throw new Error("Hanya Master");
  return ctx;
}

const refreshAll = () => revalidatePath("/", "layout");

const appSchema = z.object({
  app_name: z.string().trim().min(1, "Nama aplikasi wajib").max(60),
  accent: z.string().refine((v) => v in ACCENTS, "Aksen tidak valid"),
  font: z.string().refine((v) => v in FONTS, "Font tidak valid"),
  density: z.enum(["Nyaman", "Kompak"]),
});

export async function saveAppSettings(input: z.input<typeof appSchema>): Promise<ActionResult> {
  return run(async () => {
    const ctx = await managerCtx();
    const parsed = appSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const { error } = await ctx.supabase.from("app_settings").update(parsed.data).eq("tenant_id", ctx.profile.tenant_id);
    if (error) return fail(dbError(error));
    refreshAll();
    return ok(undefined, "Tampilan disimpan");
  });
}

const headerSchema = z.object({
  showClock: z.boolean(),
  showBadge: z.boolean(),
  showTheme: z.boolean(),
  showOnline: z.boolean(),
});

export async function saveHeaderCfg(input: z.input<typeof headerSchema>): Promise<ActionResult> {
  return run(async () => {
    const ctx = await managerCtx();
    const parsed = headerSchema.safeParse(input);
    if (!parsed.success) return fail("Data tidak valid");
    const { error } = await ctx.supabase
      .from("app_settings")
      .update({ header_cfg: parsed.data })
      .eq("tenant_id", ctx.profile.tenant_id);
    if (error) return fail(dbError(error));
    refreshAll();
    return ok(undefined, "Header disimpan");
  });
}

const menuSchema = z.object({
  labels: z.record(z.string().max(40), z.string().trim().max(60)),
  icons: z.record(z.string().max(40), z.enum(MENU_ICONS)),
  menu_order: z.array(z.string().max(40)).max(100),
  visibility: z.record(z.string().max(40), z.boolean()),
});

export async function saveMenuConfig(input: z.input<typeof menuSchema>): Promise<ActionResult> {
  return run(async () => {
    const ctx = await managerCtx();
    const parsed = menuSchema.safeParse(input);
    if (!parsed.success) return fail("Konfigurasi menu tidak valid");
    // Menu Settings tidak boleh disembunyikan (agar tidak terkunci di luar)
    const visibility = { ...parsed.data.visibility, settings: true };
    const { error } = await ctx.supabase
      .from("menu_config")
      .update({ ...parsed.data, visibility })
      .eq("tenant_id", ctx.profile.tenant_id);
    if (error) return fail(dbError(error));
    refreshAll();
    return ok(undefined, "Menu disimpan");
  });
}

export async function resetMenuConfig(): Promise<ActionResult> {
  return run(async () => {
    const ctx = await managerCtx();
    const [m, a] = await Promise.all([
      ctx.supabase
        .from("menu_config")
        .update({ labels: {}, icons: {}, menu_order: [], visibility: {} })
        .eq("tenant_id", ctx.profile.tenant_id),
      ctx.supabase
        .from("app_settings")
        .update({
          app_name: "TITAN APEX V4",
          accent: "Emerald",
          font: "Inter",
          density: "Nyaman",
          header_cfg: { showClock: true, showBadge: true, showTheme: true, showOnline: true },
        })
        .eq("tenant_id", ctx.profile.tenant_id),
    ]);
    if (m.error || a.error) return fail(dbError(m.error ?? a.error));
    refreshAll();
    return ok(undefined, "Reset ke default");
  });
}

const customMenuSchema = z.object({
  menu_key: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_-]{2,32}$/, "ID 2-32 karakter: huruf kecil, angka, _ atau -")
    .refine((v) => !BASE_MENUS.some((m) => m.id === v), "ID bentrok dengan menu bawaan"),
  label: z.string().trim().min(1, "Label wajib").max(60),
  icon: z.enum(MENU_ICONS),
});

export async function addCustomMenu(input: z.input<typeof customMenuSchema>): Promise<ActionResult> {
  return run(async () => {
    const ctx = await managerCtx();
    const parsed = customMenuSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const { menu_key, label } = parsed.data;
    const { error } = await ctx.supabase.from("custom_menus").insert({
      ...parsed.data,
      // Konten disanitasi DOMPurify saat render
      content: `<h1>${label.replace(/[<>&"]/g, "")}</h1><p>Isi SOP / info bebas untuk ${label.replace(/[<>&"]/g, "")}</p>`,
    });
    if (error) return fail(error.code === "23505" ? "ID sudah ada" : dbError(error));
    const order = ctx.menuConfig.menu_order.length ? ctx.menuConfig.menu_order : BASE_MENUS.map((m) => m.id);
    await ctx.supabase
      .from("menu_config")
      .update({ menu_order: [...order.filter((o) => o !== menu_key), menu_key] })
      .eq("tenant_id", ctx.profile.tenant_id);
    refreshAll();
    return ok(undefined, "Menu kustom ditambah");
  });
}

export async function updateCustomMenuContent(id: string, content: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await managerCtx();
    if (typeof content !== "string" || content.length > 200_000) return fail("Konten terlalu besar");
    const { data, error } = await ctx.supabase.from("custom_menus").update({ content }).eq("id", id).select("menu_key");
    if (error) return fail(dbError(error));
    if (!data?.length) return fail("Menu tidak ditemukan");
    revalidatePath(`/custom/${data[0].menu_key}`);
    return ok(undefined, "Isi disimpan");
  });
}

export async function deleteCustomMenu(id: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await managerCtx();
    const { data, error } = await ctx.supabase.from("custom_menus").delete().eq("id", id).select("menu_key");
    if (error) return fail(dbError(error));
    const key = data?.[0]?.menu_key;
    if (key) {
      const omit = <T,>(o: Record<string, T>) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== key));
      const visibility = omit(ctx.menuConfig.visibility);
      const labels = omit(ctx.menuConfig.labels);
      const icons = omit(ctx.menuConfig.icons);
      await ctx.supabase
        .from("menu_config")
        .update({ menu_order: ctx.menuConfig.menu_order.filter((o) => o !== key), visibility, labels, icons })
        .eq("tenant_id", ctx.profile.tenant_id);
    }
    refreshAll();
    return ok(undefined, "Menu kustom dihapus");
  });
}

// ---------------------------------------------------------------------------
// Backup / Restore / Reset — khusus Master, per tenant
// ---------------------------------------------------------------------------

/** urutan aman terhadap foreign key */
const DATA_TABLES: EntityKey[] = [
  "customers", "sales_forecast", "sales_daily", "admin_daily", "pipeline", "quotation",
  "forecast_trend", "actual_vs_forecast", "documentation", "refreshment", "evaluation",
];
const CONFIG_TABLES = ["app_settings", "menu_config", "custom_menus", "access_control"] as const;
const GENERATED_COLS: Partial<Record<EntityKey, string[]>> = { quotation: ["total", "margin_rp"] };

export async function backupTenant(): Promise<ActionResult<Record<string, unknown>>> {
  return run(async () => {
    const ctx = await masterCtx();
    const out: Record<string, unknown> = {
      _meta: { app: "titan-apex", version: 1, tenant: ctx.tenant.code, exported_at: new Date().toISOString() },
    };
    for (const t of [...DATA_TABLES, ...CONFIG_TABLES]) {
      const { data, error } = await ctx.supabase.from(t).select("*");
      if (error) return fail(dbError(error));
      out[t] = data;
    }
    return ok(out);
  });
}

export async function restoreTenant(backup: Record<string, unknown>): Promise<ActionResult> {
  return run(async () => {
    const ctx = await masterCtx();
    const tenantId = ctx.profile.tenant_id;
    if (!backup || typeof backup !== "object" || !("customers" in backup)) return fail("File backup tidak valid");
    const admin = createAdminClient();
    const { data: members } = await admin.from("profiles").select("id").eq("tenant_id", tenantId);
    const memberIds = new Set((members ?? []).map((m) => m.id));
    const mapUser = (id: unknown) => (typeof id === "string" && memberIds.has(id) ? id : null);

    let restored = 0;
    for (const t of DATA_TABLES) {
      const rows = backup[t];
      if (!Array.isArray(rows) || !rows.length) continue;
      const def = ENTITIES[t];
      const clean: Record<string, unknown>[] = [];
      for (const r of rows as Record<string, unknown>[]) {
        const parsed = def.schema.safeParse(r);
        if (!parsed.success || typeof r.id !== "string") continue;
        const row: Record<string, unknown> = {
          ...parsed.data,
          id: r.id,
          tenant_id: tenantId, // selalu dipaksa ke tenant pemanggil
          owner: mapUser(r.owner) ?? ctx.profile.id,
          created_at: r.created_at,
        };
        if (t === "customers") row.customer_code = r.customer_code;
        if ("sales_id" in row) row.sales_id = mapUser(row.sales_id);
        for (const f of filePathFields(def)) {
          // path file dari tenant lain tidak boleh dibawa
          if (typeof r[f] === "string" && (r[f] as string).startsWith(`${tenantId}/`)) row[f] = r[f];
        }
        for (const g of GENERATED_COLS[t] ?? []) delete row[g];
        clean.push(row);
      }
      if (!clean.length) continue;
      // Hanya baris dengan id yang belum dimiliki tenant lain (upsert by id dalam tenant ini)
      const ids = clean.map((c) => c.id as string);
      const { data: foreign } = await admin.from(t).select("id").in("id", ids).neq("tenant_id", tenantId);
      const foreignIds = new Set((foreign ?? []).map((f) => f.id));
      const safe = clean.filter((c) => !foreignIds.has(c.id as string));
      const { error } = await admin.from(t).upsert(safe, { onConflict: "id" });
      if (error) return fail(`${t}: ${dbError(error)}`);
      restored += safe.length;
    }
    refreshAll();
    return ok(undefined, `Restore berhasil (${restored} baris)`);
  });
}

export async function resetTenantData(confirmCode: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await masterCtx();
    if (confirmCode !== ctx.tenant.code) return fail("Kode konfirmasi salah");
    const admin = createAdminClient();
    const tenantId = ctx.profile.tenant_id;
    // Hapus file Storage tenant
    for (const t of DATA_TABLES) {
      const paths = filePathFields(ENTITIES[t]);
      if (!paths.length) continue;
      const { data } = await admin.from(t).select(paths.join(",")).eq("tenant_id", tenantId);
      const files = (data ?? [])
        .flatMap((r) => paths.map((p) => (r as unknown as Record<string, string | null>)[p]))
        .filter((p): p is string => !!p);
      if (files.length) await admin.storage.from(STORAGE_BUCKET).remove(files);
    }
    for (const t of [...DATA_TABLES].reverse()) {
      const { error } = await admin.from(t).delete().eq("tenant_id", tenantId);
      if (error) return fail(`${t}: ${dbError(error)}`);
    }
    refreshAll();
    return ok(undefined, "Semua data operasional tenant dihapus");
  });
}
