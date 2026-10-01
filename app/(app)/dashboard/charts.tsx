"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useOnlineUsers } from "@/components/layout/presence-provider";
import { fmtJuta, fmtRupiah } from "@/lib/format";

const SERIES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

const legendText = (value: string) => <span style={{ color: "var(--muted-foreground)" }}>{value}</span>;

const tooltipStyle = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--popover-foreground)",
    fontSize: 12,
  },
  itemStyle: { color: "var(--popover-foreground)" },
};

export function OnlineCount() {
  return <>{useOnlineUsers().length}</>;
}

export function ForecastChart({ data }: { data: { part: string; target: number; actual: number }[] }) {
  if (!data.length) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ left: 8, right: 8 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="part" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
        <YAxis
          tickFormatter={(v) => fmtJuta(v)}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={false}
          width={70}
        />
        <Tooltip {...tooltipStyle} cursor={{ fill: "var(--muted)" }} formatter={(v) => fmtRupiah(v)} />
        <Legend wrapperStyle={{ fontSize: 12 }} formatter={legendText} />
        <Bar dataKey="target" name="Target" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={36} />
        <Bar dataKey="actual" name="Actual" fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function QuotationChart({ data }: { data: { status: string; count: number }[] }) {
  if (!data.length) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} formatter={legendText} />
        <Pie
          data={data}
          dataKey="count"
          nameKey="status"
          innerRadius={60}
          outerRadius={95}
          paddingAngle={data.length > 1 ? 2 : 0}
          stroke="var(--card)"
          strokeWidth={2}
        >
          {data.map((d, i) => (
            <Cell key={d.status} fill={SERIES[i % SERIES.length]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

export function RankBar({ data, money }: { data: { name: string; value: number }[]; money?: boolean }) {
  if (!data.length) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 44)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={120}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          {...tooltipStyle}
          cursor={{ fill: "var(--muted)" }}
          formatter={(v) => (money ? fmtRupiah(v) : String(v))}
        />
        <Bar dataKey="value" name={money ? "Actual Rp" : "Actual Qty"} fill={SERIES[0]} radius={[0, 4, 4, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function Empty() {
  return <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Belum ada data</div>;
}
