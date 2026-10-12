import { redirect } from "next/navigation";
import { Hourglass, LogOut } from "lucide-react";
import { getSession } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";

export default async function PendingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.profile?.active && (session.profile.role === "moderator" || session.profile.tenant_id))
    redirect(session.profile.role === "moderator" ? "/moderator" : "/dashboard");

  return (
    <AuthShell>
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
          <Hourglass className="size-6" />
        </span>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Akun menunggu aktivasi</h1>
          <p className="text-sm text-muted-foreground">
            Halo <span className="font-medium text-foreground">{session.profile?.name ?? session.user.email}</span>. Akun
            Anda belum aktif atau belum ditempatkan di perusahaan. Moderator akan mengaktifkannya.
          </p>
        </div>
        <form action={logout} className="w-full">
          <Button variant="outline" type="submit" className="w-full">
            <LogOut /> Keluar
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
