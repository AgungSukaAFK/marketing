"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, Clock, Users } from "lucide-react";
import { AccentThemeSwitcher } from "@/components/accent-theme-switcher";
import { FontSwitcher } from "@/components/font-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { isActiveHref, type SidebarMenuItemData } from "@/components/layout/app-sidebar";
import { useOnlineUsers } from "@/components/layout/presence-provider";
import { RoleBadge } from "@/components/role-badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { HeaderCfg, Role } from "@/lib/constants";

function WibClock() {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    const tick = () =>
      setNow(
        new Date().toLocaleTimeString("id-ID", {
          timeZone: "Asia/Jakarta",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }) + " WIB",
      );
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="hidden items-center gap-1.5 px-2 text-xs text-muted-foreground tabular-nums md:flex">
      <Clock className="size-3.5" />
      <span suppressHydrationWarning>{now ?? "--.--.-- WIB"}</span>
    </div>
  );
}

function LiveBadge() {
  return (
    <span className="hidden items-center gap-1.5 rounded-full border bg-background px-2.5 py-0.5 text-xs font-medium shadow-xs md:inline-flex">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-500 opacity-60 motion-reduce:animate-none" />
        <span className="relative inline-flex size-2 rounded-full bg-green-500" />
      </span>
      Live
    </span>
  );
}

function OnlineWidget() {
  const online = useOnlineUsers();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" title="Akun online" className="gap-1.5">
          <Users className="text-muted-foreground" size={16} />
          <span className="tabular-nums">{online.length}</span>
          <span className="hidden sm:inline">Online</span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Akun Online ({online.length})</p>
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {online.length ? (
            online.map((o) => (
              <div key={o.user_id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
                <span className="size-2 shrink-0 rounded-full bg-green-500" />
                <span className="min-w-0 flex-1 truncate">{o.name}</span>
                <RoleBadge role={o.role as Role} />
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {new Date(o.online_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">Tidak ada akun online</p>
          )}
        </div>
        <Button asChild size="sm" variant="outline" className="mt-3 w-full">
          <Link href="/accounts">Lihat Riwayat Login</Link>
        </Button>
      </PopoverContent>
    </Popover>
  );
}

export function Header({
  appName,
  menus,
  role,
  headerCfg,
}: {
  appName: string;
  menus: SidebarMenuItemData[];
  role: Role;
  headerCfg: HeaderCfg;
}) {
  const pathname = usePathname();
  const current =
    menus.find((m) => isActiveHref(pathname, m.href))?.label ?? (pathname.startsWith("/forbidden") ? "Akses Ditolak" : "");
  const isManager = role === "master" || role === "admin";

  return (
    <header className="no-print sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 border-b bg-background transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex min-w-0 flex-1 items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
        <Breadcrumb className="min-w-0">
          <BreadcrumbList className="flex-nowrap">
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink asChild>
                <Link href="/dashboard">{appName}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            {current && (
              <>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem className="min-w-0">
                  <BreadcrumbPage className="truncate">{current}</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="flex shrink-0 items-center gap-0.5 pr-3 md:pr-4">
        {headerCfg.showClock && <WibClock />}
        {headerCfg.showBadge && <LiveBadge />}
        {headerCfg.showOnline && isManager && <OnlineWidget />}
        {headerCfg.showTheme && (
          <>
            <AccentThemeSwitcher />
            <FontSwitcher />
            <ThemeSwitcher />
          </>
        )}
      </div>
    </header>
  );
}
