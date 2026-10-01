import { redirect } from "next/navigation";
import { Hourglass } from "lucide-react";
import { getSession } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function PendingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.profile?.active && (session.profile.role === "moderator" || session.profile.tenant_id))
    redirect(session.profile.role === "moderator" ? "/moderator" : "/dashboard");

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 text-center">
          <Hourglass className="mx-auto size-10 text-brand-text" />
          <h1 className="text-lg font-bold">Akun menunggu aktivasi</h1>
          <p className="text-sm text-muted-foreground">
            Halo {session.profile?.name ?? session.user.email}. Akun Anda belum aktif atau belum ditempatkan di
            perusahaan. Moderator akan mengaktifkannya.
          </p>
          <form action={logout}>
            <Button variant="secondary" type="submit">
              Logout
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
