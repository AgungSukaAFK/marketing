"use client";

import * as React from "react";
import { Building2, Check, Palette } from "lucide-react";
import { useCustomTheme, accentThemes } from "@/lib/theme-provider";
import { FOLLOW_COMPANY } from "@/lib/accent-options";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const companyThemes = accentThemes.filter((t) => t.group === "company");
const generalThemes = accentThemes.filter((t) => t.group === "general");

export function AccentThemeSwitcher() {
  const { accent, accentChoice, setAccent, company } = useCustomTheme();
  const active = accentThemes.find((t) => t.name === accent);
  const companyAccent = accentThemes.find((t) => t.name === (company?.accent ?? "zinc"));
  const followCompany = accentChoice === FOLLOW_COMPANY;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" title="Warna aksen" aria-label="Warna aksen">
          <Palette className="text-muted-foreground" size={16} />
          {active && (
            <span
              className="h-3 w-3 rounded-full border"
              style={{ backgroundColor: active.color }}
            />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 p-2" align="end">
        <DropdownMenuItem
          onClick={() => setAccent(FOLLOW_COMPANY)}
          className={cn(
            "mb-1 flex items-center gap-2 rounded-md border px-2 py-1.5",
            followCompany && "border-primary",
          )}
        >
          <Building2 className="text-muted-foreground" />
          <span className="flex-1">
            <span className="block text-sm font-medium">Default Perusahaan</span>
            <span className="block text-[11px] text-muted-foreground">
              {company ? `Diatur admin · ${companyAccent?.label}` : "Mengikuti pengaturan admin"}
            </span>
          </span>
          {companyAccent && (
            <span
              className="h-4 w-4 shrink-0 rounded-full border"
              style={{ backgroundColor: companyAccent.color }}
            />
          )}
          {followCompany && <Check className="h-4 w-4" />}
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-2" />

        <DropdownMenuLabel className="px-1 pb-1 pt-0 text-xs text-muted-foreground">
          Warna Perusahaan
        </DropdownMenuLabel>
        <div className="grid grid-cols-2 gap-1.5">
          {companyThemes.map((theme) => {
            const selected = !followCompany && accent === theme.name;
            return (
              <DropdownMenuItem
                key={theme.name}
                onClick={() => setAccent(theme.name)}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-2 py-1.5",
                  selected && "border-primary",
                )}
              >
                <span
                  className="h-5 w-5 shrink-0 rounded-full border"
                  style={{ backgroundColor: theme.color }}
                />
                <span className="font-semibold">{theme.label}</span>
                {selected && <Check className="ml-auto h-4 w-4" />}
              </DropdownMenuItem>
            );
          })}
        </div>

        <DropdownMenuSeparator className="my-2" />

        <DropdownMenuLabel className="px-1 pb-1 pt-0 text-xs text-muted-foreground">
          Warna Umum
        </DropdownMenuLabel>
        <div className="grid grid-cols-4 gap-1">
          {generalThemes.map((theme) => {
            const selected = !followCompany && accent === theme.name;
            return (
              <DropdownMenuItem
                key={theme.name}
                onClick={() => setAccent(theme.name)}
                title={theme.label}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-md px-1 py-1.5",
                  selected && "bg-accent",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full border",
                    selected && "ring-2 ring-offset-2 ring-offset-background",
                  )}
                  style={
                    {
                      backgroundColor: theme.color,
                      "--tw-ring-color": theme.color,
                    } as React.CSSProperties
                  }
                >
                  {selected && <Check className="h-3.5 w-3.5 text-white" />}
                </span>
                <span className="w-full truncate text-center text-[10px] leading-tight">
                  {theme.name === "zinc" ? "Default" : theme.label}
                </span>
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
