"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireModerator } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { activateSchema, moderatorCreateSchema, tenantSchema } from "@/lib/schemas/account";
import { dbError, fail, ok, type ActionResult } from "@/lib/action-result";
import { run } from "@/lib/safe-action";

/** Tenant baru / ubah tenant — hanya moderator. */
export async function saveTenant(id: string | null, input: z.input<typeof tenantSchema>): Promise<ActionResult> {
  return run(async () => {
    await requireModerator();
    const parsed = tenantSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const admin = createAdminClient();
    const { error } = id
      ? await admin.from("tenants").update(parsed.data).eq("id", id)
      : await admin.from("tenants").insert(parsed.data);
    if (error) return fail(error.code === "23505" ? "Kode company sudah dipakai" : dbError(error));
    revalidatePath("/moderator");
    return ok(undefined, id ? "Company diupdate" : "Company dibuat");
  });
}

/** Akun baru oleh moderator — email terkonfirmasi & langsung aktif, tinggal login. */
export async function createUserByModerator(input: z.input<typeof moderatorCreateSchema>): Promise<ActionResult> {
  return run(async () => {
    await requireModerator();
    const parsed = moderatorCreateSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const v = parsed.data;
    const tenant_id = v.role === "moderator" ? null : v.tenant_id;

    const admin = createAdminClient();
    const { data: taken } = await admin.from("profiles").select("id").eq("username", v.username).maybeSingle();
    if (taken) return fail("Username sudah dipakai");

    const { data, error } = await admin.auth.admin.createUser({
      email: v.email,
      password: v.password,
      email_confirm: true,
      user_metadata: { name: v.name, username: v.username },
    });
    if (error || !data.user) return fail(error?.message ?? "Gagal membuat akun");

    const { error: upErr } = await admin
      .from("profiles")
      .update({ name: v.name, username: v.username, role: v.role, tenant_id, active: true })
      .eq("id", data.user.id);
    if (upErr) {
      // Jangan tinggalkan akun setengah jadi
      await admin.auth.admin.deleteUser(data.user.id);
      return fail(dbError(upErr));
    }
    revalidatePath("/moderator");
    return ok(undefined, "Akun dibuat & aktif");
  });
}

/**
 * Aktivasi / ubah akun: assign tenant + role + data lain.
 * Aturan: tidak bisa menonaktifkan / menurunkan diri sendiri; Master aktif terakhir di tenant dilindungi.
 */
export async function saveUserAssignment(userId: string, input: z.input<typeof activateSchema>): Promise<ActionResult> {
  return run(async () => {
    const { user } = await requireModerator();
    const parsed = activateSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const v = parsed.data;
    const tenant_id = v.role === "moderator" ? null : v.tenant_id;
    if (userId === user.id && (!v.active || v.role !== "moderator"))
      return fail("Tidak bisa menonaktifkan / menurunkan role diri sendiri");

    const admin = createAdminClient();
    const { data: current } = await admin.from("profiles").select("role, active, tenant_id").eq("id", userId).single();
    if (!current) return fail("Akun tidak ditemukan");

    const leavesMaster =
      current.role === "master" && current.active && (v.role !== "master" || !v.active || tenant_id !== current.tenant_id);
    if (leavesMaster) {
      const { count } = await admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", current.tenant_id)
        .eq("role", "master")
        .eq("active", true)
        .neq("id", userId);
      if (!count) return fail("Ini Master aktif terakhir di tenant tsb. Angkat Master lain dulu.");
    }

    const { data: dup } = await admin.from("profiles").select("id").eq("username", v.username).neq("id", userId).maybeSingle();
    if (dup) return fail("Username sudah dipakai");

    const { error } = await admin
      .from("profiles")
      .update({ name: v.name, username: v.username, role: v.role, tenant_id, active: v.active })
      .eq("id", userId);
    if (error) return fail(dbError(error));

    // Pindah tenant → batasan menu lama tidak berlaku lagi
    if (tenant_id !== current.tenant_id) await admin.from("access_control").delete().eq("user_id", userId);

    revalidatePath("/moderator");
    return ok(undefined, v.active ? "Akun aktif & tersimpan" : "Akun disimpan (nonaktif)");
  });
}

export async function deleteUser(userId: string): Promise<ActionResult> {
  return run(async () => {
    const { user } = await requireModerator();
    if (userId === user.id) return fail("Tidak bisa menghapus diri sendiri");
    const admin = createAdminClient();
    const { data: p } = await admin.from("profiles").select("role, active, tenant_id").eq("id", userId).single();
    if (p?.role === "master" && p.active) {
      const { count } = await admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", p.tenant_id)
        .eq("role", "master")
        .eq("active", true)
        .neq("id", userId);
      if (!count) return fail("Master aktif terakhir di tenant tidak bisa dihapus");
    }
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) return fail("Akun masih memiliki data. Nonaktifkan saja.");
    revalidatePath("/moderator");
    return ok(undefined, "Akun dihapus");
  });
}
