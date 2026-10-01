import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireMenu } from "@/lib/auth";
import { fmtJuta, fmtPercent, toNumber } from "@/lib/format";
import { ForecastChart, OnlineCount, QuotationChart } from "./charts";

export default async function DashboardPage() {
  const { supabase } = await requireMenu("dashboard");
  // RLS otomatis membatasi Sales ke data miliknya (setara filterOwner prototipe)
  const [cust, pipe, fc, quot] = await Promise.all([
    supabase.from("customers").select("id", { count: "exact", head: true }),
    supabase.from("pipeline").select("value"),
    supabase.from("sales_forecast").select("part_no, t_qty, t_rp, actual_qty, actual_rp").order("created_at"),
    supabase.from("quotation").select("po_status"),
  ]);

  const pipelineValue = (pipe.data ?? []).reduce((a, r) => a + toNumber(r.value), 0);
  const forecasts = fc.data ?? [];
  const ach = forecasts.length
    ? (forecasts.reduce((a, r) => a + (toNumber(r.t_qty) ? toNumber(r.actual_qty) / toNumber(r.t_qty) : 0), 0) /
        forecasts.length) *
      100
    : 0;

  const quotCount = new Map<string, number>();
  for (const q of quot.data ?? []) quotCount.set(q.po_status, (quotCount.get(q.po_status) ?? 0) + 1);

  const kpis: [string, React.ReactNode][] = [
    ["Customers", cust.count ?? 0],
    ["Pipeline Value", fmtJuta(pipelineValue)],
    ["Forecast ACH", fmtPercent(ach)],
    ["Online", <OnlineCount key="o" />],
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {kpis.map(([label, value]) => (
          <Card key={label}>
            <CardContent>
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="text-2xl font-bold tabular-nums">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Forecast vs Actual (Rp)</CardTitle>
          </CardHeader>
          <CardContent>
            <ForecastChart
              data={forecasts.slice(0, 6).map((r) => ({
                part: r.part_no,
                target: toNumber(r.t_rp),
                actual: toNumber(r.actual_rp),
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Quotation Status</CardTitle>
          </CardHeader>
          <CardContent>
            <QuotationChart data={[...quotCount].map(([status, count]) => ({ status, count }))} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
