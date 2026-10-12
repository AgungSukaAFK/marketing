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
    <Card className="col-span-12 mx-auto w-full max-w-lg">
      <CardContent className="flex flex-col items-center gap-3 py-4 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldX className="size-6" />
        </span>
        <h1 className="text-lg font-semibold">Akses Ditolak</h1>
        <p className="text-sm text-muted-foreground">
          Menu {typeof menu === "string" ? <span className="font-medium text-foreground">{menu}</span> : "ini"}{" "}
          disembunyikan atau dibatasi oleh Master.
        </p>
        {home && (
          <Button asChild variant="outline" size="sm">
            <Link href={home.href}>Buka {home.label}</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
