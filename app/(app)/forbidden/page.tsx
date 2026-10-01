import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getAppContext } from "@/lib/auth";

export default async function ForbiddenPage({ searchParams }: PageProps<"/forbidden">) {
  const { menu } = await searchParams;
  const { menus } = await getAppContext();
  const home = menus[0];
  return (
    <Card className="mx-auto max-w-lg">
      <CardContent className="space-y-3 py-6 text-center">
        <ShieldX className="mx-auto size-10 text-destructive" />
        <h2 className="text-lg font-bold">Akses Ditolak</h2>
        <p className="text-sm text-muted-foreground">
          Menu {typeof menu === "string" ? <b>{menu}</b> : "ini"} disembunyikan atau dibatasi oleh Master.
        </p>
        {home && (
          <Button asChild variant="secondary">
            <Link href={home.href}>Buka {home.label}</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
