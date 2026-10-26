"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAppContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";
import { activityHeaders } from "@/lib/request-context";
import { createAccountSchema, updateAccountSchema } from "@/lib/schemas/account";
import { dbError, fail, ok, type ActionResult } from "@/lib/action-result";
import { run } from "@/lib/safe-action";
import { BASE_MENUS, type TenantRole } from "@/lib/constants";

/** Hierarki (sama dengan prototipe): Master kelola semua, Admin hanya Sales. */
function canManage(actor: TenantRole, target: TenantRole | null) {
  if (actor === "master") return true;
  if (actor === "admin") return target === "sales";
  return false;
}

async function managerContext() {
  const ctx = await getAppContext();
  if (ctx.profile.role !== "master" && ctx.profile.role !== "admin") throw new Error("Hanya Master/Admin");
  return ctx;
}

async function loadTarget(userId: string, ctx: Awaited<ReturnType<typeof managerContext>>) {
  const admin = createAdminClient(await activityHeaders(ctx.profile.id));
  const { data } = await admin
    .from("profiles")
    .select("id, name, username, email, role, active, tenant_id")
    .eq("id", userId)
    .single();
  if (!data || data.tenant_id !== ctx.profile.tenant_id) throw new Error("Akun tidak ditemukan di tenant ini");
  return {
    admin,
    target: data as {
      id: string;
      name: string;
      username: string;
      email: string;
      role: TenantRole | null;
      active: boolean;
      tenant_id: string;
    },
  };
}

/** Minimal 1 Master aktif per tenant harus selalu ada. */
async function assertMasterRemains(admin: ReturnType<typeof createAdminClient>, tenantId: string, excludingId: string) {
  const { count } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("role", "master")
    .eq("active", true)
    .neq("id", excludingId);
  if (!count) throw new Error("Harus ada minimal 1 Master aktif");
}

export async function createAccount(input: z.input<typeof createAccountSchema>): Promise<ActionResult> {
  return run(async () => {
    const ctx = await managerContext();
    const parsed = createAccountSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const v = parsed.data;
    if (!canManage(ctx.profile.role, v.role)) return fail("Admin hanya bisa membuat akun Sales");

    const admin = createAdminClient(await activityHeaders(ctx.profile.id));
    const { data: taken } = await admin.from("profiles").select("id").eq("username", v.username).maybeSingle();
    if (taken) return fail("Username sudah dipakai");

    const { data, error } = await admin.auth.admin.createUser({
      email: v.email,
      password: v.password,
      email_confirm: true,
      user_metadata: { name: v.name, username: v.username },
    });
    if (error || !data.user) return fail(error?.message ?? "Gagal membuat akun");
    // Dibuat oleh Master/Admin → langsung aktif di tenant yang sama
    const { error: upErr } = await admin
      .from("profiles")
      .update({ tenant_id: ctx.profile.tenant_id, role: v.role, active: true })
      .eq("id", data.user.id);
    if (upErr) return fail(dbError(upErr));
    await logActivity({
      action: "account_create",
      actorId: ctx.profile.id,
      entity: "profiles",
      recordId: data.user.id,
      label: `${v.name} (@${v.username})`,
      meta: { email: v.email, role: v.role },
    });
    revalidatePath("/accounts");
    revalidatePath("/settings");
    return ok(undefined, "Akun ditambah");
  });
}

export async function updateAccount(userId: string, input: z.input<typeof updateAccountSchema>): Promise<ActionResult> {
  return run(async () => {
    const ctx = await managerContext();
    const parsed = updateAccountSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const v = parsed.data;
    const { admin, target } = await loadTarget(userId, ctx);
    if (!canManage(ctx.profile.role, target.role)) return fail("Tidak berwenang");
    if (!canManage(ctx.profile.role, v.role)) return fail("Admin hanya bisa mengelola role Sales");
    if (userId === ctx.profile.id && (v.role !== target.role || !v.active))
      return fail("Tidak bisa mengubah role / menonaktifkan diri sendiri");
    if (target.role === "master" && target.active && (v.role !== "master" || !v.active))
      await assertMasterRemains(admin, ctx.profile.tenant_id, userId);

    const { data: dup } = await admin.from("profiles").select("id").eq("username", v.username).neq("id", userId).maybeSingle();
    if (dup) return fail("Username sudah dipakai");

    const { error } = await admin.from("profiles").update(v).eq("id", userId);
    if (error) return fail(dbError(error));
    revalidatePath("/accounts");
    revalidatePath("/settings");
    return ok(undefined, "Akun diupdate");
  });
}

export async function resetAccountPassword(userId: string, password: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await managerContext();
    const pw = z.string().min(8, "Password minimal 8 karakter").max(72).safeParse(password);
    if (!pw.success) return fail(pw.error.issues[0].message);
    const { admin, target } = await loadTarget(userId, ctx);
    if (!canManage(ctx.profile.role, target.role)) return fail("Tidak berwenang");
    const { error } = await admin.auth.admin.updateUserById(userId, { password: pw.data });
    if (error) return fail(error.message);
    await logActivity({
      action: "password_reset",
      actorId: ctx.profile.id,
      entity: "profiles",
      recordId: userId,
      label: `${target.name} (@${target.username})`,
    });
    return ok(undefined, "Password direset");
  });
}

export async function deleteAccount(userId: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await managerContext();
    if (userId === ctx.profile.id) return fail("Tidak bisa menghapus diri sendiri");
    const { admin, target } = await loadTarget(userId, ctx);
    if (!canManage(ctx.profile.role, target.role)) return fail("Tidak berwenang");
    if (target.role === "master") await assertMasterRemains(admin, ctx.profile.tenant_id, userId);
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) return fail("Akun masih memiliki data. Nonaktifkan saja akunnya.");
    await logActivity({
      action: "account_delete",
      actorId: ctx.profile.id,
      entity: "profiles",
      recordId: userId,
      label: `${target.name} (@${target.username})`,
      meta: { email: target.email, role: target.role },
    });
    revalidatePath("/accounts");
    revalidatePath("/settings");
    return ok(undefined, "Akun dihapus");
  });
}

const accessSchema = z.object({
  enabled: z.boolean(),
  allowed_menus: z.array(z.string().max(40)).max(100),
});

/** Kontrol akses per akun — khusus Master (juga dipaksakan oleh RLS). */
export async function setAccessControl(userId: string, input: z.input<typeof accessSchema>): Promise<ActionResult> {
  return run(async () => {
    const ctx = await getAppContext();
    if (ctx.profile.role !== "master") return fail("Hanya Master");
    const parsed = accessSchema.safeParse(input);
    if (!parsed.success) return fail("Data tidak valid");
    const known = new Set([...BASE_MENUS.map((m) => m.id), ...ctx.customMenus.map((c) => c.menu_key)]);
    const { error } = await ctx.supabase.from("access_control").upsert({
      user_id: userId,
      tenant_id: ctx.profile.tenant_id,
      enabled: parsed.data.enabled,
      allowed_menus: parsed.data.allowed_menus.filter((m) => known.has(m)),
    });
    if (error) return fail(dbError(error));
    revalidatePath("/settings");
    return ok(undefined, "Kontrol akses disimpan");
  });
}
