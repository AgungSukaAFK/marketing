import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { HeaderCfg, Role, TenantRole } from "@/lib/constants";
import { visibleMenus, type AccessRow, type CustomMenuRow, type MenuConfig } from "@/lib/menus";

export type Profile = {
  id: string;
  tenant_id: string | null;
  username: string;
  name: string;
  email: string;
  role: Role | null;
  active: boolean;
  last_seen_at: string | null;
  created_at: string;
};

export type AppSettings = {
  app_name: string;
  accent: string;
  font: string;
  density: "Nyaman" | "Kompak";
  header_cfg: HeaderCfg;
};

/** Sesi + profil, di-cache per request. */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  return { supabase, user, profile };
});

/** Wajib login, akun aktif, dan anggota tenant (bukan moderator). */
export const requireTenantUser = cache(async () => {
  const session = await getSession();
  if (!session) redirect("/login");
  const { profile } = session;
  if (!profile?.active) redirect("/pending");
  if (profile.role === "moderator") redirect("/moderator");
  if (!profile.tenant_id || !profile.role) redirect("/pending");
  return { ...session, profile: profile as Profile & { tenant_id: string; role: TenantRole } };
});

export async function requireModerator() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.profile?.active) redirect("/pending");
  if (session.profile.role !== "moderator") redirect("/dashboard");
  return session;
}

/** Konteks aplikasi tenant: setting tampilan, menu, akses. */
export const getAppContext = cache(async () => {
  const session = await requireTenantUser();
  const { supabase, profile } = session;
  const [settings, menuCfg, custom, access, tenant] = await Promise.all([
    supabase.from("app_settings").select("app_name, accent, font, density, header_cfg").single<AppSettings>(),
    supabase.from("menu_config").select("labels, icons, menu_order, visibility").single<MenuConfig>(),
    supabase.from("custom_menus").select("id, menu_key, label, icon, content").order("created_at").returns<CustomMenuRow[]>(),
    supabase.from("access_control").select("enabled, allowed_menus").eq("user_id", profile.id).maybeSingle<NonNullable<AccessRow>>(),
    supabase.from("tenants").select("id, name, code").single<{ id: string; name: string; code: string }>(),
  ]);
  const menuConfig: MenuConfig = menuCfg.data ?? { labels: {}, icons: {}, menu_order: [], visibility: {} };
  const customMenus = custom.data ?? [];
  const menus = visibleMenus(menuConfig, customMenus, profile.role, access.data ?? null);
  return {
    ...session,
    tenant: tenant.data!,
    settings: settings.data ?? {
      app_name: "TITAN APEX V4",
      accent: "Emerald",
      font: "Inter",
      density: "Nyaman" as const,
      header_cfg: { showClock: true, showBadge: true, showTheme: true, showOnline: true },
    },
    menuConfig,
    customMenus,
    menus,
  };
});

/**
 * Guard route per menu: ditolak bila menu disembunyikan / dibatasi Master.
 * Data tetap aman oleh RLS — ini hanya guard UI.
 */
export async function requireMenu(menuId: string) {
  const ctx = await getAppContext();
  const menu = ctx.menus.find((m) => m.id === menuId);
  if (!menu) redirect(`/forbidden?menu=${encodeURIComponent(menuId)}`);
  return { ...ctx, menu };
}
