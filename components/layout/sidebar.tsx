"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MenuIcon } from "@/lib/icons";
import { ROLE_LABEL, type Role } from "@/lib/constants";
import type { ResolvedMenu } from "@/lib/menus";

export type SidebarProps = {
  appName: string;
  menus: Pick<ResolvedMenu, "id" | "label" | "icon" | "href" | "custom">[];
  userName: string;
  role: Role;
  tenantName: string;
  onNavigate?: () => void;
};

export function SidebarContent({ appName, menus, userName, role, tenantName, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-5">
        <h1 className="truncate text-lg font-bold text-brand-text">{appName}</h1>
        <p className="text-[10px] tracking-widest text-muted-foreground">INDUSTRIAL &amp; MINING CRM</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{tenantName}</p>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {menus.map((m) => {
          const active = pathname === m.href || pathname.startsWith(m.href + "/");
          return (
            <Link
              key={m.id}
              href={m.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                active ? "bg-primary font-bold text-primary-foreground" : "hover:bg-sidebar-accent",
              )}
            >
              <MenuIcon name={m.icon} className="size-4 shrink-0" />
              <span className="truncate">{m.label}</span>
              {m.custom && <span className="ml-auto text-[9px] opacity-60">CUSTOM</span>}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-3 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="size-2 animate-pulse rounded-full bg-brand" />
          {userName} ({ROLE_LABEL[role]})
        </div>
      </div>
    </div>
  );
}
