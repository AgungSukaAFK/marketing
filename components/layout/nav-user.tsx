"use client";

import { useState } from "react";
import { Building2, ChevronsUpDown, LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { LogoutDialog } from "@/components/layout/logout-dialog";
import { RoleBadge } from "@/components/role-badge";
import type { Role } from "@/lib/constants";

export type NavUserProps = {
  user: { name: string; email: string; role: Role; tenantName: string };
};

/** "Budi Santoso" → "BS" */
export function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

export function NavUser({ user }: NavUserProps) {
  const { isMobile } = useSidebar();
  const [logoutOpen, setLogoutOpen] = useState(false);

  const identity = (
    <>
      <Avatar className="h-8 w-8 rounded-lg">
        <AvatarFallback className="rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
          {getInitials(user.name)}
        </AvatarFallback>
      </Avatar>
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{user.name}</span>
        <span className="truncate text-xs text-muted-foreground">{user.email}</span>
      </div>
    </>
  );

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                {identity}
                <ChevronsUpDown className="ml-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5">{identity}</div>
              </DropdownMenuLabel>
              <div className="flex items-center gap-2 px-2 pb-1.5 text-xs text-muted-foreground">
                <RoleBadge role={user.role} />
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{user.tenantName}</span>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setLogoutOpen(true)}>
                <LogOut />
                Keluar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
      <LogoutDialog open={logoutOpen} onOpenChange={setLogoutOpen} />
    </>
  );
}
