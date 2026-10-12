import { Building2, Target, Users, Wallet } from "lucide-react";
import { Content } from "@/components/content";
import { StatCard } from "@/components/stat-card";
import { requireMenu } from "@/lib/auth";
import { fmtJuta, fmtNumber, fmtPercent, toNumber } from "@/lib/format";
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

  return (
    <>
      <StatCard label="Customers" value={fmtNumber(cust.count ?? 0)} icon={Building2} />
      <StatCard
        label="Pipeline Value"
        value={fmtJuta(pipelineValue)}
        hint={`${fmtNumber((pipe.data ?? []).length)} deal`}
        icon={Wallet}
      />
      <StatCard label="Forecast ACH" value={fmtPercent(ach)} hint="Rata-rata capaian qty" icon={Target} />
      <StatCard label="Online" value={<OnlineCount />} hint="Akun aktif saat ini" icon={Users} />

      <Content size="md" title="Forecast vs Actual" description="Nilai Rupiah, 6 forecast pertama">
        <ForecastChart
          data={forecasts.slice(0, 6).map((r) => ({
            part: r.part_no,
            target: toNumber(r.t_rp),
            actual: toNumber(r.actual_rp),
          }))}
        />
      </Content>
      <Content size="md" title="Quotation Status" description="Jumlah quotation per status PO">
        <QuotationChart data={[...quotCount].map(([status, count]) => ({ status, count }))} />
      </Content>
    </>
  );
}
