import { Check } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-svh items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="fade-in grid w-full max-w-5xl overflow-hidden rounded-2xl border bg-card md:grid-cols-2">
        <div className="flex flex-col justify-between gap-8 bg-gradient-to-br from-brand/20 to-cyan-500/10 p-8 md:p-10">
          <div>
            <h1 className="text-3xl font-bold text-brand-text">TITAN APEX V4</h1>
            <p className="mt-2 text-sm text-muted-foreground">Industrial &amp; Mining CRM — Master Control Edition</p>
            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              {[
                "Hierarki Moderator › Master › Admin › Sales",
                "Online real-time + riwayat login",
                "Customer Code terintegrasi + kontrol akses menu",
                "Data per perusahaan terisolasi (multi-tenant)",
              ].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="size-4 text-brand-text" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-muted-foreground">
            Akun baru perlu diaktifkan oleh moderator sebelum bisa masuk.
          </p>
        </div>
        <div className="p-8 md:p-10">{children}</div>
      </div>
    </div>
  );
}
