import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireMenu } from "@/lib/auth";
import { fmtJuta, fmtNumber, toNumber } from "@/lib/format";
import { RankBar } from "../dashboard/charts";

export default async function AnalyticsPage() {
  const { supabase } = await requireMenu("analytics");
  const [fc, profiles] = await Promise.all([
    supabase.from("sales_forecast").select("sales_id, part_no, actual_qty, actual_rp"),
    supabase.from("profiles").select("id, username"),
  ]);
  const username = new Map((profiles.data ?? []).map((p) => [p.id, p.username]));

  const bySales = new Map<string, number>();
  const byPart = new Map<string, number>();
  for (const r of fc.data ?? []) {
    const s = (r.sales_id && username.get(r.sales_id)) || "-";
    bySales.set(s, (bySales.get(s) ?? 0) + toNumber(r.actual_rp));
    byPart.set(r.part_no, (byPart.get(r.part_no) ?? 0) + toNumber(r.actual_qty));
  }
  const top = (m: Map<string, number>) =>
    [...m]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));
  const topSales = top(bySales);
  const topPart = top(byPart);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Top Sales (Actual Rp)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RankBar data={topSales} money />
          <ol className="space-y-1">
            {topSales.map((s, i) => (
              <li key={s.name} className="flex justify-between rounded-md bg-muted p-2 text-sm">
                <span>
                  #{i + 1} {s.name}
                </span>
                <span className="tabular-nums">{fmtJuta(s.value, 1)}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Top Sparepart (Actual Qty)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RankBar data={topPart} />
          <ol className="space-y-1">
            {topPart.map((p, i) => (
              <li key={p.name} className="flex justify-between rounded-md bg-muted p-2 text-sm">
                <span className="font-mono">
                  #{i + 1} {p.name}
                </span>
                <span className="tabular-nums">{fmtNumber(p.value)}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
