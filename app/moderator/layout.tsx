import Image from "next/image";
import { AccentThemeSwitcher } from "@/components/accent-theme-switcher";
import { FontSwitcher } from "@/components/font-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { UserMenu } from "@/components/layout/user-menu";
import { Separator } from "@/components/ui/separator";
import { requireModerator } from "@/lib/auth";
import { DEFAULT_APP_NAME } from "@/lib/constants";

export default async function ModeratorLayout({ children }: { children: React.ReactNode }) {
  const { profile, user } = await requireModerator();
  return (
    <div className="min-h-svh">
      <header className="no-print sticky top-0 z-20 border-b bg-background">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Image src="/icons/icon-192.png" alt="" width={32} height={32} className="size-8 rounded-md" />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold">{DEFAULT_APP_NAME}</p>
              <p className="truncate text-xs text-muted-foreground">Moderator · Platform Control</p>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <AccentThemeSwitcher />
            <FontSwitcher />
            <ThemeSwitcher />
            <Separator orientation="vertical" className="mx-1.5 data-[orientation=vertical]:h-5" />
            <UserMenu name={profile?.name ?? user.email ?? "-"} email={user.email ?? ""} role="moderator" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4 md:py-6">
        <div className="grid auto-rows-auto grid-cols-12 items-start gap-4 md:gap-6">{children}</div>
      </main>
    </div>
  );
}
