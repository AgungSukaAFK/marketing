import Link from "next/link";
import { Building2 } from "lucide-react";
import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { loadEntity } from "@/lib/data";
import { SalesDailyView } from "./sales-daily-view";

export default async function Page() {
  const { rows, lookups, me, ctx } = await loadEntity("sales_daily");
  if (!lookups.customers.length) {
    const canCustomer = ctx.menus.some((m) => m.id === "customer");
    return (
      <Content title="Sales Daily Activity">
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <Building2 className="size-8 text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-medium">Belum ada data customer</p>
            <p className="text-sm text-muted-foreground">Isi Customer DB dulu sebelum mencatat aktivitas.</p>
          </div>
          {canCustomer && (
            <Button asChild size="sm">
              <Link href="/customers">Buka Customer DB</Link>
            </Button>
          )}
        </div>
      </Content>
    );
  }
  return (
    <SalesDailyView
      rows={rows}
      lookups={lookups}
      me={me}
      canPipeline={ctx.menus.some((m) => m.id === "pipeline")}
    />
  );
}
