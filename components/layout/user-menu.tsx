"use client";

import { useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogoutDialog } from "@/components/layout/logout-dialog";
import { getInitials } from "@/components/layout/nav-user";
import { RoleBadge } from "@/components/role-badge";
import type { Role } from "@/lib/constants";

/** Menu user di header (halaman tanpa sidebar, mis. Moderator). */
export function UserMenu({ name, email, role }: { name: string; email: string; role: Role }) {
  const [logoutOpen, setLogoutOpen] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2 pl-1">
            <Avatar className="h-7 w-7 rounded-md">
              <AvatarFallback className="rounded-md bg-primary text-[11px] font-semibold text-primary-foreground">
                {getInitials(name)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-32 truncate md:inline">{name}</span>
            <ChevronDown className="text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuLabel className="font-normal">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
            <div className="mt-1.5">
              <RoleBadge role={role} />
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setLogoutOpen(true)}>
            <LogOut /> Keluar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <LogoutDialog open={logoutOpen} onOpenChange={setLogoutOpen} />
    </>
  );
}
