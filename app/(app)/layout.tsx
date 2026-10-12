import { cookies } from "next/headers";
import { getAppContext } from "@/lib/auth";
import { normalizeAccent } from "@/lib/accent-options";
import { companyThemeScript, normalizeFont } from "@/lib/font-options";
import { CompanyTheme } from "@/lib/theme-provider";
import { InlineScript } from "@/components/inline-script";
import { AppSidebar, type AppSidebarProps } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";
import { PresenceProvider } from "@/components/layout/presence-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAppContext();
  const { profile, settings, menus, tenant } = ctx;
  // posisi sidebar (buka/ciut) diingat lewat cookie oleh SidebarProvider
  const sidebarOpen = (await cookies()).get("sidebar_state")?.value !== "false";

  const accent = normalizeAccent(settings.accent);
  const font = normalizeFont(settings.font);
  const sidebarMenus: AppSidebarProps["menus"] = menus.map(({ id, label, defaultLabel, icon, href, group, custom }) => ({
    id,
    label,
    defaultLabel,
    icon,
    href,
    group,
    custom,
  }));

  return (
    <PresenceProvider
      tenantId={profile.tenant_id}
      me={{ user_id: profile.id, name: profile.name, username: profile.username, role: profile.role }}
    >
      {/* aksen & font default perusahaan (App Customizer) dipasang sebelum paint,
          kecuali user sudah memilih sendiri di header */}
      <InlineScript html={companyThemeScript(accent, font)} />
      <CompanyTheme accent={accent} font={font} />
      <SidebarProvider defaultOpen={sidebarOpen} data-density={settings.density}>
        <AppSidebar
          className="no-print"
          appName={settings.app_name}
          tenantName={tenant.name}
          menus={sidebarMenus}
          user={{ name: profile.name, email: profile.email, role: profile.role, tenantName: tenant.name }}
        />
        <SidebarInset>
          <Header appName={settings.app_name} menus={sidebarMenus} role={profile.role} headerCfg={settings.header_cfg} />
          <div className="flex flex-1 flex-col gap-4 p-4">
            <div className="grid auto-rows-auto grid-cols-12 items-start gap-4 md:gap-6">{children}</div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </PresenceProvider>
  );
}
