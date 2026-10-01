import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { loadEntity } from "@/lib/data";
import { SalesDailyView } from "./sales-daily-view";

export default async function Page() {
  const { rows, lookups, me, ctx } = await loadEntity("sales_daily");
  if (!lookups.customers.length) {
    const canCustomer = ctx.menus.some((m) => m.id === "customer");
    return (
      <Card>
        <CardContent className="py-6 text-center">
          Isi Customer DB dulu.{" "}
          {canCustomer && (
            <Link href="/customers" className="text-brand-text underline">
              Buka Customer DB
            </Link>
          )}
        </CardContent>
      </Card>
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
