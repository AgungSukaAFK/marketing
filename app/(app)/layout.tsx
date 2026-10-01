import { getAppContext } from "@/lib/auth";
import { tenantThemeCss } from "@/lib/theme";
import { Header } from "@/components/layout/header";
import { PresenceProvider } from "@/components/layout/presence-provider";
import { SidebarContent, type SidebarProps } from "@/components/layout/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAppContext();
  const { profile, settings, menus, tenant } = ctx;

  const sidebar: SidebarProps = {
    appName: settings.app_name,
    menus: menus.map(({ id, label, icon, href, custom }) => ({ id, label, icon, href, custom })),
    userName: profile.name,
    role: profile.role,
    tenantName: tenant.name,
  };

  return (
    <PresenceProvider
      tenantId={profile.tenant_id}
      me={{ user_id: profile.id, name: profile.name, username: profile.username, role: profile.role }}
    >
      {/* aksen & font per tenant (nilai tervalidasi dari daftar tetap) */}
      <style>{tenantThemeCss(settings.accent, settings.font)}</style>
      <div className="flex min-h-svh" data-density={settings.density}>
        <aside className="glass sticky top-0 hidden h-svh w-72 shrink-0 border-r lg:block">
          <SidebarContent {...sidebar} />
        </aside>
        <main className="flex min-w-0 flex-1 flex-col">
          <Header sidebar={sidebar} headerCfg={settings.header_cfg} />
          <div className="fade-in flex-1 p-4 md:p-6">{children}</div>
        </main>
      </div>
    </PresenceProvider>
  );
}
