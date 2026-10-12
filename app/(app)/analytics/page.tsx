import { Content } from "@/components/content";
import { requireMenu } from "@/lib/auth";
import { fmtJuta, fmtNumber, toNumber } from "@/lib/format";
import { RankBar } from "../dashboard/charts";

function RankList({ items, format, mono }: { items: { name: string; value: number }[]; format: (v: number) => string; mono?: boolean }) {
  if (!items.length) return null;
  return (
    <ol className="divide-y rounded-md border">
      {items.map((s, i) => (
        <li key={s.name} className="flex items-center gap-3 px-3 py-2 text-sm">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">
            {i + 1}
          </span>
          <span className={mono ? "truncate font-mono text-xs" : "truncate"}>{s.name}</span>
          <span className="ml-auto font-medium tabular-nums">{format(s.value)}</span>
        </li>
      ))}
    </ol>
  );
}

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
    <>
      <Content size="md" title="Top Sales" description="5 sales dengan Actual Rp tertinggi">
        <div className="space-y-4">
          <RankBar data={topSales} money />
          <RankList items={topSales} format={(v) => fmtJuta(v, 1)} />
        </div>
      </Content>
      <Content size="md" title="Top Sparepart" description="5 part dengan Actual Qty tertinggi">
        <div className="space-y-4">
          <RankBar data={topPart} />
          <RankList items={topPart} format={fmtNumber} mono />
        </div>
      </Content>
    </>
  );
}
