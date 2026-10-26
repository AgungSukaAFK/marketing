"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, Pie, PieChart, XAxis, YAxis } from "recharts";
import { BarChart3 } from "lucide-react";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { fmtNumber, fmtPercent, fmtRpShort, fmtRupiah, fmtShort } from "@/lib/format";
import { cn } from "@/lib/utils";

// Animasi chart dimatikan: ganti filter langsung tampil tanpa jank saat banyak grafik dirender ulang.

/** Seri kategorikal dalam urutan tetap (app/globals.css → --viz-*). Warna ikut entitas, bukan peringkat. */
export const VIZ = ["var(--viz-1)", "var(--viz-2)", "var(--viz-3)", "var(--viz-4)", "var(--viz-5)", "var(--viz-6)"];
export const VIZ_MUTED = "var(--viz-muted)";
export const QUOT_COLORS: Record<string, string> = {
  Draft: VIZ_MUTED,
  Negosiasi: "var(--viz-warn)",
  Win: "var(--viz-good)",
  Loss: "var(--viz-bad)",
  Cancel: "hsl(var(--muted-foreground) / 0.75)",
  Open: "var(--viz-warn)",
};

const BAR = 24;

/** Klik pada pita kategori (bukan hanya batang) → index baris. */
const clickIndex =
  (onSelect?: (i: number) => void) =>
  (s: { activeTooltipIndex?: unknown } | null | undefined) => {
    const i = Number(s?.activeTooltipIndex);
    if (onSelect && Number.isInteger(i) && i >= 0) onSelect(i);
  };

export function ChartEmpty({ text = "Belum ada data di periode ini", className }: { text?: string; className?: string }) {
  return (
    <div className={cn("flex h-48 flex-col items-center justify-center gap-2 text-sm text-muted-foreground", className)}>
      <BarChart3 className="size-6" />
      {text}
    </div>
  );
}

/** Baris tooltip: nilai di depan (tebal), nama seri di belakang, kunci garis berwarna. */
function Row({ color, name, value }: { color: string; name: string; value: string }) {
  return (
    <div className="flex w-full items-center gap-2">
      <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: color }} />
      <span className="text-muted-foreground">{name}</span>
      <span className="ml-auto pl-3 font-mono font-medium text-foreground tabular-nums">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Target vs Actual (bulan / kategori)
// ---------------------------------------------------------------------------
const targetConfig = {
  target: { label: "Target", color: VIZ_MUTED },
  actual: { label: "Actual", color: VIZ[0] },
} satisfies ChartConfig;

export function TargetActualChart({
  data,
  onSelect,
  height = 288,
}: {
  /** dim: baris di luar periode terpilih (konteks) */
  data: { label: string; target: number; actual: number; dim?: boolean }[];
  onSelect?: (index: number) => void;
  height?: number;
}) {
  if (!data.some((d) => d.target || d.actual)) return <ChartEmpty />;
  return (
    <ChartContainer config={targetConfig} className="aspect-auto w-full" style={{ height }}>
      <BarChart data={data} margin={{ left: 4, right: 4, top: 8 }} barGap={2} onClick={clickIndex(onSelect)}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval="preserveStartEnd" />
        <YAxis tickFormatter={(v) => fmtShort(v)} tickLine={false} axisLine={false} width={48} />
        <ChartTooltip
          cursor={{ fill: "hsl(var(--muted) / 0.5)" }}
          content={
            <ChartTooltipContent
              className="min-w-44"
              formatter={(v, name, item) => (
                <>
                  <Row color={item.color ?? ""} name={targetConfig[name as keyof typeof targetConfig]?.label ?? String(name)} value={fmtRupiah(v)} />
                  {name === "actual" && item.payload.target > 0 && (
                    <Row color="transparent" name="ACH" value={fmtPercent((item.payload.actual / item.payload.target) * 100)} />
                  )}
                </>
              )}
            />
          }
        />
        <ChartLegend itemSorter={null} content={<ChartLegendContent />} />
        {(["target", "actual"] as const).map((k) => (
          <Bar
            key={k}
            dataKey={k}
            fill={`var(--color-${k})`}
            radius={[4, 4, 0, 0]}
            maxBarSize={BAR}
            isAnimationActive={false}
            className={onSelect ? "cursor-pointer" : undefined}
          >
            {data.map((d, i) => (
              <Cell key={i} fillOpacity={d.dim ? 0.4 : 1} />
            ))}
          </Bar>
        ))}
      </BarChart>
    </ChartContainer>
  );
}

// ---------------------------------------------------------------------------
// Tren garis (jumlah per bucket waktu)
// ---------------------------------------------------------------------------
/** Warna dipakai langsung (bukan var(--color-<key>)) karena key boleh berspasi, mis. "In Progress". */
export type Series = { key: string; label: string; color: string };

export function TrendLines({
  data,
  series,
  onSelect,
  money,
  height = 288,
}: {
  data: Record<string, string | number>[];
  series: Series[];
  onSelect?: (index: number) => void;
  money?: boolean;
  height?: number;
}) {
  if (!data.some((d) => series.some((s) => Number(d[s.key])))) return <ChartEmpty />;
  const config: ChartConfig = Object.fromEntries(series.map((s) => [s.key, { label: s.label, color: s.color }]));
  const dots = data.length <= 14;
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <LineChart data={data} margin={{ left: 4, right: 12, top: 8 }} onClick={clickIndex(onSelect)} className={onSelect ? "cursor-pointer" : undefined}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
        <YAxis
          tickFormatter={(v) => fmtShort(v)}
          tickLine={false}
          axisLine={false}
          width={40}
          allowDecimals={false}
        />
        <ChartTooltip
          cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
          content={
            <ChartTooltipContent
              className="min-w-40"
              formatter={(v, name, item) => (
                <Row color={item.color ?? ""} name={String(config[name as string]?.label ?? name)} value={money ? fmtRupiah(v) : fmtNumber(v)} />
              )}
            />
          }
        />
        <ChartLegend itemSorter={null} content={<ChartLegendContent className="flex-wrap" />} />
        {series.map((s) => (
          <Line
            key={s.key}
            dataKey={s.key}
            type="monotone"
            stroke={s.color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={dots ? { r: 4, fill: s.color, stroke: "var(--color-card)", strokeWidth: 2 } : false}
            activeDot={{ r: 5, stroke: "var(--color-card)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}

// ---------------------------------------------------------------------------
// Batang bertumpuk per bucket waktu
// ---------------------------------------------------------------------------
export function StackedBars({
  data,
  series,
  onSelect,
  money,
  height = 288,
}: {
  data: Record<string, string | number>[];
  series: Series[];
  onSelect?: (index: number) => void;
  money?: boolean;
  height?: number;
}) {
  if (!data.some((d) => series.some((s) => Number(d[s.key])))) return <ChartEmpty />;
  const config: ChartConfig = Object.fromEntries(series.map((s) => [s.key, { label: s.label, color: s.color }]));
  const fmt = money ? fmtRupiah : fmtNumber;
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <BarChart data={data} margin={{ left: 4, right: 4, top: 8 }} onClick={clickIndex(onSelect)}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
        <YAxis tickFormatter={(v) => fmtShort(v)} tickLine={false} axisLine={false} width={44} allowDecimals={false} />
        <ChartTooltip
          cursor={{ fill: "hsl(var(--muted) / 0.5)" }}
          content={
            <ChartTooltipContent
              className="min-w-44"
              formatter={(v, name, item) => (
                <Row color={item.color ?? ""} name={String(config[name as string]?.label ?? name)} value={fmt(v)} />
              )}
            />
          }
        />
        <ChartLegend itemSorter={null} content={<ChartLegendContent className="flex-wrap" />} />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            stackId="a"
            fill={s.color}
            stroke="var(--color-card)"
            strokeWidth={1}
            radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
            maxBarSize={BAR + 8}
            isAnimationActive={false}
            className={onSelect ? "cursor-pointer" : undefined}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}

// ---------------------------------------------------------------------------
// Batang horizontal (stage, tipe, peringkat) — nilai di ujung batang
// ---------------------------------------------------------------------------
export function HBars({
  data,
  onSelect,
  format = fmtNumber,
  color = VIZ[0],
  label = "Jumlah",
}: {
  data: { name: string; value: number; sub?: string }[];
  onSelect?: (index: number) => void;
  format?: (v: number) => string;
  color?: string;
  label?: string;
}) {
  if (!data.some((d) => d.value)) return <ChartEmpty />;
  const config = { value: { label, color } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height: Math.max(160, data.length * 36 + 16) }}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 56, top: 4, bottom: 4 }} onClick={clickIndex(onSelect)}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={112}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: string) => (v.length > 16 ? `${v.slice(0, 15)}…` : v)}
        />
        <ChartTooltip
          cursor={{ fill: "hsl(var(--muted) / 0.5)" }}
          content={
            <ChartTooltipContent
              className="min-w-40"
              labelFormatter={(l, p) => (
                <div className="grid grid-cols-1 gap-0.5">
                  <span>{String(l)}</span>
                  {p?.[0]?.payload?.sub && <span className="font-normal text-muted-foreground">{p[0].payload.sub}</span>}
                </div>
              )}
              formatter={(v) => <Row color={color} name={label} value={format(Number(v))} />}
            />
          }
        />
        <Bar dataKey="value" fill="var(--color-value)" radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false} className={onSelect ? "cursor-pointer" : undefined}>
          <LabelList dataKey="value" position="right" offset={8} className="fill-foreground text-xs tabular-nums" formatter={(v: unknown) => format(Number(v))} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

// ---------------------------------------------------------------------------
// Donut bagian-dari-keseluruhan (≤ 6 segmen) + legenda yang bisa diklik
// ---------------------------------------------------------------------------
export function Donut({
  data,
  center,
  centerLabel,
  onSelect,
}: {
  data: { name: string; count: number; value: number; color: string }[];
  center: string;
  centerLabel: string;
  onSelect?: (index: number) => void;
}) {
  const shown = data.filter((d) => d.count);
  if (!shown.length) return <ChartEmpty />;
  const config: ChartConfig = Object.fromEntries(data.map((d) => [d.name, { label: d.name, color: d.color }]));
  const total = shown.reduce((a, d) => a + d.count, 0);
  return (
    <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <ChartContainer config={config} className="mx-auto aspect-square h-52 w-full max-w-60">
        <PieChart>
          <ChartTooltip
            content={
              <ChartTooltipContent
                hideLabel
                nameKey="name"
                formatter={(v, name, item) => (
                  <div className="grid grid-cols-1 w-full gap-1">
                    <Row color={item.payload.color} name={String(name)} value={`${fmtNumber(v)} barang`} />
                    <Row color="transparent" name="Nilai" value={fmtRupiah(item.payload.value)} />
                  </div>
                )}
              />
            }
          />
          <Pie
            data={shown}
            dataKey="count"
            nameKey="name"
            innerRadius="62%"
            outerRadius="92%"
            paddingAngle={shown.length > 1 ? 2 : 0}
            stroke="var(--color-card)"
            strokeWidth={2}
            isAnimationActive={false}
            onClick={(_, i) => onSelect?.(data.indexOf(shown[i]))}
            className={onSelect ? "cursor-pointer" : undefined}
          >
            {shown.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-xl font-semibold">
            {center}
          </text>
          <text x="50%" y="59%" textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-xs">
            {centerLabel}
          </text>
        </PieChart>
      </ChartContainer>
      <ul className="grid grid-cols-1 gap-1">
        {data.map((d, i) => (
          <li key={d.name}>
            <button
              type="button"
              disabled={!d.count || !onSelect}
              onClick={() => onSelect?.(i)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
            >
              <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: d.color }} />
              <span className="min-w-0 flex-1 truncate">{d.name}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{total ? fmtPercent((d.count / total) * 100) : "-"}</span>
              <span className="w-20 text-right font-medium tabular-nums">{fmtRpShort(d.value)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Progress bar capaian (track = langkah lebih terang dari warna isi). */
export function Meter({ value, className }: { value: number | null; className?: string }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  const tone = value == null ? "bg-muted-foreground/40" : value >= 100 ? "bg-[var(--viz-good)]" : value >= 70 ? "bg-primary" : "bg-[var(--viz-warn)]";
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className={cn("h-full rounded-full transition-[width] duration-500", tone)} style={{ width: `${v}%` }} />
    </div>
  );
}
