import { Hourglass } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { requireMenu } from "@/lib/auth";

export default async function SalesActualPage() {
  const { menu } = await requireMenu("sales_actual");
  return (
    <Card className="col-span-12 mx-auto w-full max-w-lg">
      <CardContent className="flex flex-col items-center gap-3 py-4 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Hourglass className="size-6" />
        </span>
        <h1 className="text-lg font-semibold">{menu.label}</h1>
        <p className="text-sm text-muted-foreground">Fitur ini sedang disiapkan dan akan segera tersedia.</p>
      </CardContent>
    </Card>
  );
}
