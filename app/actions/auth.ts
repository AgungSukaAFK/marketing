"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { loginSchema, passwordSchema, registerSchema } from "@/lib/schemas/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hit, isLimited, rateLimit } from "@/lib/rate-limit";
import { fail, ok, type ActionResult } from "@/lib/action-result";

export async function login(input: z.input<typeof loginSchema>, next?: string): Promise<ActionResult> {
  // Hanya login GAGAL yang dihitung (10x / 5 menit per IP)
  if (await isLimited("login", 10)) return fail("Terlalu banyak percobaan gagal, coba lagi beberapa menit lagi");
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    await hit("login");
    return fail("Email atau password salah");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("active, role, tenant_id")
    .eq("id", data.user.id)
    .single();

  if (!profile?.active) {
    await supabase.auth.signOut();
    return fail("Akun belum diaktifkan. Hubungi moderator untuk aktivasi.");
  }

  await supabase.from("login_history").insert({ user_id: data.user.id, tenant_id: profile.tenant_id, action: "LOGIN" });
  await createAdminClient().from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", data.user.id);

  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
  redirect(profile.role === "moderator" ? "/moderator" : safeNext ?? "/dashboard");
}

export async function register(input: z.input<typeof registerSchema>): Promise<ActionResult> {
  if (!(await rateLimit("register", 5, 15 * 60_000))) return fail("Terlalu banyak pendaftaran, coba lagi nanti");
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { name, username, email, password } = parsed.data;

  const admin = createAdminClient();
  const { data: taken } = await admin.from("profiles").select("id").eq("username", username).maybeSingle();
  if (taken) return fail("Username sudah dipakai");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, username } },
  });
  if (error) return fail(error.message.includes("registered") ? "Email sudah terdaftar" : error.message);
  // "Confirm email" dimatikan → signUp langsung membuat sesi. Akun belum aktif, jadi keluarkan lagi.
  if (data.session) await supabase.auth.signOut();
  return ok(undefined, "Registrasi berhasil. Akun Anda menunggu aktivasi oleh moderator.");
}

export async function forgotPassword(email: string): Promise<ActionResult> {
  if (!(await rateLimit("forgot", 5, 15 * 60_000))) return fail("Terlalu banyak permintaan, coba lagi nanti");
  const parsed = z.email("Email tidak valid").safeParse(email);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const h = await headers();
  const origin = h.get("origin") ?? `http://${h.get("host")}`;
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });
  // Selalu sukses agar tidak membocorkan email mana yang terdaftar
  return ok(undefined, "Jika email terdaftar, link reset password sudah dikirim.");
}

export async function updatePassword(input: z.input<typeof passwordSchema>): Promise<ActionResult> {
  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail(error.message);
  return ok(undefined, "Password diperbarui");
}

export async function logout() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("tenant_id, active").eq("id", user.id).single();
    if (profile?.active) {
      await supabase.from("login_history").insert({ user_id: user.id, tenant_id: profile.tenant_id, action: "LOGOUT" });
    }
  }
  await supabase.auth.signOut();
  redirect("/login");
}
