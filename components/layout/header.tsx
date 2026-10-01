"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, Clock, LogOut, Menu } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { useOnlineUsers } from "@/components/layout/presence-provider";
import { SidebarContent, type SidebarProps } from "@/components/layout/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ROLE_LABEL, type HeaderCfg } from "@/lib/constants";

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
    <div className="hidden items-center gap-2 text-xs text-muted-foreground tabular-nums md:flex">
      <Clock className="size-4" />
      <span suppressHydrationWarning>{now ?? "--:--:-- WIB"}</span>
    </div>
  );
}

function OnlineWidget() {
  const online = useOnlineUsers();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm" className="gap-1.5">
          <span className="size-2 rounded-full bg-brand" /> Online {online.length}
          <ChevronDown className="size-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <h4 className="mb-2 text-xs font-bold">Akun Online ({online.length})</h4>
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {online.length ? (
            online.map((o) => (
              <div key={o.user_id} className="flex justify-between rounded-md bg-muted p-2 text-xs">
                <span>
                  {o.name} ({ROLE_LABEL[o.role as keyof typeof ROLE_LABEL] ?? o.role})
                </span>
                <span className="text-muted-foreground">{new Date(o.online_at).toLocaleTimeString("id-ID")}</span>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">Tidak ada</p>
          )}
        </div>
        <Button asChild size="sm" className="mt-2 w-full font-bold">
          <Link href="/accounts">Lihat Riwayat Login</Link>
        </Button>
      </PopoverContent>
    </Popover>
  );
}

export function Header({ sidebar, headerCfg }: { sidebar: SidebarProps; headerCfg: HeaderCfg }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const title = sidebar.menus.find((m) => pathname === m.href || pathname.startsWith(m.href + "/"))?.label ?? "";
  const isManager = sidebar.role === "master" || sidebar.role === "admin";

  return (
    <header className="glass sticky top-0 z-20 flex items-center justify-between gap-3 border-b px-4 py-3 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Button variant="secondary" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Menu">
          <Menu />
        </Button>
        <h2 className="truncate text-base font-bold md:text-lg">{title}</h2>
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        {headerCfg.showClock && <WibClock />}
        {headerCfg.showBadge && (
          <Badge variant="outline" className="hidden border-brand/40 text-brand-text md:inline-flex">
            Live
          </Badge>
        )}
        {headerCfg.showTheme && <ThemeToggle />}
        {headerCfg.showOnline && isManager && <OnlineWidget />}
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {sidebar.userName.charAt(0).toUpperCase()}
          </div>
          <div className="hidden text-xs leading-tight md:block">
            <div className="font-bold">{sidebar.userName}</div>
            <div className="text-muted-foreground">{ROLE_LABEL[sidebar.role]}</div>
          </div>
          <form action={logout}>
            <Button variant="secondary" size="sm" type="submit" className="ml-1">
              <LogOut className="md:hidden" />
              <span className="hidden md:inline">Logout</span>
            </Button>
          </form>
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigasi</SheetTitle>
          <SidebarContent {...sidebar} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </header>
  );
}
