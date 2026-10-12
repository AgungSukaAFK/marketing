"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SearchIcon, XIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavUser, type NavUserProps } from "@/components/layout/nav-user";
import { MENU_GROUPS } from "@/lib/constants";
import { MenuIcon } from "@/lib/icons";
import { searchMenus } from "@/lib/menu-search";
import type { ResolvedMenu } from "@/lib/menus";
import { cn } from "@/lib/utils";

export type SidebarMenuItemData = Pick<ResolvedMenu, "id" | "label" | "defaultLabel" | "icon" | "href" | "group" | "custom">;

export type AppSidebarProps = {
  appName: string;
  tenantName: string;
  menus: SidebarMenuItemData[];
  user: NavUserProps["user"];
};

/** Menu aktif: href sama persis atau sub-path-nya. */
export const isActiveHref = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(href + "/");

export function AppSidebar({
  appName,
  tenantName,
  menus,
  user,
  ...props
}: AppSidebarProps & React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const searching = query.trim().length > 0;

  // saat mencari, tiap kelompok hanya berisi menu yang cocok, diurutkan dari yang paling relevan
  const { groups, best } = useMemo(() => {
    const matched = searching
      ? searchMenus(menus, query, (m) => MENU_GROUPS.find((g) => g.id === m.group)?.label ?? "")
      : menus;
    return {
      groups: MENU_GROUPS.map((g) => ({ ...g, items: matched.filter((m) => m.group === g.id) })).filter(
        (g) => g.items.length > 0,
      ),
      best: matched[0],
    };
  }, [menus, query, searching]);

  const navigate = (href: string) => {
    setQuery("");
    if (isMobile) setOpenMobile(false);
    router.push(href);
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <Link href="/dashboard" className="block rounded-md p-1 group-data-[collapsible=icon]:p-0" title={appName}>
          <Image
            src="/lourdes-logo.webp"
            alt="Lourdes Auto Parts"
            width={1024}
            height={392}
            priority
            className="h-auto w-full group-data-[collapsible=icon]:hidden"
          />
          <Image
            src="/icons/icon-192.png"
            alt=""
            width={32}
            height={32}
            className="hidden size-8 rounded-md group-data-[collapsible=icon]:block"
          />
        </Link>
        <div className="px-1 leading-tight group-data-[collapsible=icon]:hidden">
          <p className="truncate text-sm font-semibold">{appName}</p>
          <p className="truncate text-xs text-muted-foreground">{tenantName}</p>
        </div>
        <div className="relative group-data-[collapsible=icon]:hidden">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <SidebarInput
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setQuery("");
              // Enter → buka hasil paling relevan
              if (e.key === "Enter" && searching && best) navigate(best.href);
            }}
            placeholder="Cari menu…"
            aria-label="Cari menu"
            className="pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden"
          />
          {searching && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              aria-label="Hapus pencarian"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm text-muted-foreground hover:text-foreground"
            >
              <XIcon className="size-4" />
            </button>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* tanpa pencarian, urutan menu dalam tiap kelompok mengikuti menu_order dari App Customizer */}
        {groups.map((g) => (
          <SidebarGroup key={g.id}>
            <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
            <SidebarMenu>
              {g.items.map((m) => {
                const active = isActiveHref(pathname, m.href);
                return (
                  <SidebarMenuItem key={m.id}>
                    <SidebarMenuButton asChild isActive={active} tooltip={m.label}>
                      <Link
                        href={m.href}
                        aria-current={active ? "page" : undefined}
                        onClick={() => {
                          setQuery("");
                          if (isMobile) setOpenMobile(false);
                        }}
                      >
                        <MenuIcon name={m.icon} className={cn(active && "text-primary")} />
                        <span className="truncate">{m.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
        {searching && groups.length === 0 && (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
            Tidak ada menu untuk &ldquo;{query.trim()}&rdquo;
          </p>
        )}
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
