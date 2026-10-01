import { LogOut, ShieldCheck } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { requireModerator } from "@/lib/auth";

export default async function ModeratorLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireModerator();
  return (
    <div className="min-h-svh">
      <header className="glass sticky top-0 z-20 flex items-center justify-between border-b px-4 py-3 md:px-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-brand-text" />
          <div>
            <h1 className="font-bold leading-tight text-brand-text">TITAN APEX — Moderator</h1>
            <p className="text-[10px] tracking-widest text-muted-foreground">PLATFORM CONTROL</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <span className="hidden text-xs md:inline">{profile?.name}</span>
          <form action={logout}>
            <Button variant="secondary" size="sm" type="submit">
              <LogOut /> <span className="hidden md:inline">Logout</span>
            </Button>
          </form>
        </div>
      </header>
      <main className="fade-in mx-auto max-w-7xl p-4 md:p-6">{children}</main>
    </div>
  );
}
