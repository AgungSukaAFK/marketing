"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { BarChart3 } from "lucide-react";
import { useOnlineUsers } from "@/components/layout/presence-provider";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { fmtJuta, fmtNumber, fmtRupiah } from "@/lib/format";

const SERIES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export function OnlineCount() {
  return <>{useOnlineUsers().length}</>;
}

const forecastConfig = {
  target: { label: "Target", color: SERIES[0] },
  actual: { label: "Actual", color: SERIES[1] },
} satisfies ChartConfig;

export function ForecastChart({ data }: { data: { part: string; target: number; actual: number }[] }) {
  if (!data.length) return <Empty />;
  return (
    <ChartContainer config={forecastConfig} className="aspect-auto h-72 w-full">
      <BarChart data={data} margin={{ left: 4, right: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="part" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickFormatter={(v) => fmtJuta(v)} tickLine={false} axisLine={false} width={64} />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent formatter={(v, name) => <TooltipRow name={String(name)} value={fmtRupiah(v)} config={forecastConfig} />} />}
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="target" fill="var(--color-target)" radius={4} maxBarSize={36} />
        <Bar dataKey="actual" fill="var(--color-actual)" radius={4} maxBarSize={36} />
      </BarChart>
    </ChartContainer>
  );
}

export function QuotationChart({ data }: { data: { status: string; count: number }[] }) {
  if (!data.length) return <Empty />;
  const config: ChartConfig = Object.fromEntries(
    data.map((d, i) => [d.status, { label: d.status, color: SERIES[i % SERIES.length] }]),
  );
  const total = data.reduce((a, d) => a + d.count, 0);
  return (
    <ChartContainer config={config} className="mx-auto aspect-auto h-72 w-full">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent nameKey="status" hideLabel />} />
        <Pie
          data={data}
          dataKey="count"
          nameKey="status"
          innerRadius={64}
          outerRadius={96}
          paddingAngle={data.length > 1 ? 2 : 0}
          stroke="var(--color-card)"
          strokeWidth={2}
        >
          {data.map((d, i) => (
            <Cell key={d.status} fill={SERIES[i % SERIES.length]} />
          ))}
        </Pie>
        <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-2xl font-semibold">
          {fmtNumber(total)}
        </text>
        <text x="50%" y="56%" textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-xs">
          Quotation
        </text>
        <ChartLegend content={<ChartLegendContent nameKey="status" className="flex-wrap" />} />
      </PieChart>
    </ChartContainer>
  );
}

export function RankBar({ data, money }: { data: { name: string; value: number }[]; money?: boolean }) {
  if (!data.length) return <Empty />;
  const config = { value: { label: money ? "Actual Rp" : "Actual Qty", color: SERIES[0] } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height: Math.max(160, data.length * 44) }}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 16 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" width={120} tickLine={false} axisLine={false} />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              formatter={(v) => (
                <TooltipRow name="value" value={money ? fmtRupiah(v) : fmtNumber(v)} config={config} />
              )}
            />
          }
        />
        <Bar dataKey="value" fill="var(--color-value)" radius={4} maxBarSize={24} />
      </BarChart>
    </ChartContainer>
  );
}

/** Baris tooltip: titik warna, label seri, nilai terformat. */
function TooltipRow({ name, value, config }: { name: string; value: string; config: ChartConfig }) {
  return (
    <div className="flex w-full items-center gap-2">
      <span className="size-2.5 shrink-0 rounded-[2px]" style={{ background: `var(--color-${name})` }} />
      <span className="text-muted-foreground">{config[name]?.label ?? name}</span>
      <span className="ml-auto font-mono font-medium text-foreground tabular-nums">{value}</span>
    </div>
  );
}

function Empty() {
  return (
    <div className="flex h-48 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
      <BarChart3 className="size-6" />
      Belum ada data
    </div>
  );
}
