import { requireMenu } from "@/lib/auth";
import { allMenusOrdered } from "@/lib/menus";
import { SettingsView } from "./settings-view";

export default async function SettingsPage() {
  const ctx = await requireMenu("settings");
  const { supabase, profile, settings, menuConfig, customMenus, tenant } = ctx;
  const isMaster = profile.role === "master";

  const [users, access] = isMaster
    ? await Promise.all([
        supabase
          .from("profiles")
          .select("id, username, name, role, active")
          .eq("tenant_id", profile.tenant_id)
          .order("name"),
        supabase.from("access_control").select("user_id, enabled, allowed_menus"),
      ])
    : [{ data: [] }, { data: [] }];

  return (
    <SettingsView
      role={profile.role}
      tenantCode={tenant.code}
      settings={settings}
      menus={allMenusOrdered(menuConfig, customMenus).map((m) => ({
        id: m.id,
        label: m.label,
        defaultLabel: m.defaultLabel,
        icon: m.icon,
        custom: m.custom,
        visible: menuConfig.visibility[m.id] !== false,
      }))}
      customMenus={customMenus}
      users={(users.data ?? []).filter((u) => u.id !== profile.id)}
      access={access.data ?? []}
    />
  );
}
