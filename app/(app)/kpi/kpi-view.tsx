"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Activity, Award, Loader2, Minus, Target, TrendingDown, TrendingUp, Users } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { Content } from "@/components/content";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/entity/status-badge";
import { MonthPicker, formatPeriode } from "@/components/form/month-picker";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  SearchableSelect,
  SearchableSelectContent,
  SearchableSelectItem,
  SearchableSelectTrigger,
  SearchableSelectValue,
} from "@/components/ui/searchable-select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtJuta, fmtNumber, fmtPercent, pct } from "@/lib/format";
import {
  KPI_CAP,
  KPI_DEFS,
  KPI_GRADES,
  KPI_GROUPS,
  kpiGrade,
  type KpiCard,
  type KpiDef,
  type KpiGroup,
  type KpiValue,
} from "@/lib/kpi";
import { DELTA_TEXT, GRADE_BAR } from "@/lib/status";
import { cn } from "@/lib/utils";

export type KpiPerson = { id: string; username: string; name: string };

type Props = {
  month: string;
  /** bulan tren, dari yang terlama; elemen terakhir = `month` */
  months: string[];
  people: KpiPerson[];
  /** per sales: KpiCard untuk tiap bulan di `months` */
  cards: Record<string, KpiCard[]>;
  summary: { salesTarget: number; salesActual: number; activities: number };
  isManager: boolean;
};

const fmtScore = (v: number) => v.toFixed(1);

function fmtValue(def: KpiDef, v: number) {
  if (def.unit === "percent") return fmtPercent(v);
  if (def.unit === "score") return fmtScore(v);
  return fmtNumber(v);
}

const fmtTarget = (def: KpiDef) => (def.unit === "percent" ? `${def.target}%` : fmtNumber(def.target));

const groupWeight = (g: KpiGroup) => KPI_DEFS.filter((d) => d.group === g).reduce((a, d) => a + d.weight, 0);

/** "2026-10" → "Okt 26" */
function shortMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
}

export function KpiView({ month, months, people, cards, summary, isManager }: Props) {
  const router = useRouter();
  const [loading, startLoading] = useTransition();
  const last = months.length - 1;

  const current = (id: string) => cards[id][last];
  const previous = (id: string) => (last > 0 ? cards[id][last - 1] : undefined);
  const ranking = [...people].sort((a, b) => current(b.id).total - current(a.id).total);

  const [selectedId, setSelectedId] = useState<string>();
  const selected = people.find((p) => p.id === selectedId) ?? ranking[0];

  const select = (id: string) => {
    setSelectedId(id);
    document.getElementById("kpi-rapor")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const header = (
    <Content
      title="Key Performance Indicators"
      description={`Periode ${formatPeriode(month)} · Draft internal — KPI, target, dan bobot akan disesuaikan saat evaluasi`}
      cardAction={
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Memuat" />}
          <Badge variant="outline" className="whitespace-nowrap">
            Demo
          </Badge>
          <div className="w-48">
            <MonthPicker
              value={month}
              onChange={(v) => v !== month && startLoading(() => router.push(`/kpi?periode=${v}`))}
            />
          </div>
        </div>
      }
    />
  );

  if (!selected) {
    return (
      <>
        {header}
        <Content>
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Users className="size-8 text-muted-foreground" />
            <p className="font-medium">Belum ada akun Sales aktif</p>
            <p className="text-sm text-muted-foreground">KPI dihitung per akun dengan role Sales.</p>
          </div>
        </Content>
        <Definitions />
      </>
    );
  }

  const teamAvg = (i: number) => people.reduce((a, p) => a + cards[p.id][i].total, 0) / people.length;
  const reached = people.filter((p) => current(p.id).total >= KPI_GRADES[1].min).length;
  const mine = current(selected.id);
  const prevMine = previous(selected.id);

  return (
    <>
      {header}

      {isManager ? (
        <>
          <StatCard
            label="Skor Rata-rata Tim"
            value={fmtScore(teamAvg(last))}
            hint={`${kpiGrade(teamAvg(last))} · ${people.length} sales`}
            icon={Award}
          />
          <SalesStat summary={summary} />
          <StatCard
            label="Aktivitas Selesai"
            value={fmtNumber(summary.activities)}
            hint="Sales Daily Activity, seluruh tim"
            icon={Activity}
          />
          <StatCard
            label="Predikat Baik ke Atas"
            value={`${reached} / ${people.length}`}
            hint={`Sales dengan skor ≥ ${KPI_GRADES[1].min}`}
            icon={Users}
          />
        </>
      ) : (
        <>
          <StatCard label="Skor KPI Saya" value={fmtScore(mine.total)} hint={kpiGrade(mine.total)} icon={Award} />
          <SalesStat summary={summary} />
          <StatCard
            label="Aktivitas Selesai"
            value={fmtNumber(summary.activities)}
            hint={`Target ${fmtNumber(KPI_DEFS.find((d) => d.id === "activity")!.target)} per bulan`}
            icon={Activity}
          />
          <StatCard
            label="Dibanding Bulan Lalu"
            value={prevMine ? <Delta value={mine.total - prevMine.total} /> : "-"}
            hint={prevMine ? `Skor ${formatPeriode(prevMine.month)}: ${fmtScore(prevMine.total)}` : undefined}
            icon={TrendingUp}
          />
        </>
      )}

      {isManager && (
        <Content title="Peringkat Sales" description="Klik nama sales untuk melihat rapor KPI-nya">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10 text-muted-foreground">#</TableHead>
                <TableHead className="text-muted-foreground">Sales</TableHead>
                {KPI_GROUPS.map((g) => (
                  <TableHead key={g} className="text-right text-muted-foreground">
                    {g} <span className="font-normal">({groupWeight(g)}%)</span>
                  </TableHead>
                ))}
                <TableHead className="min-w-44 text-muted-foreground">Skor</TableHead>
                <TableHead className="text-right text-muted-foreground">vs Bulan Lalu</TableHead>
                <TableHead className="text-muted-foreground">Predikat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranking.map((p, i) => {
                const c = current(p.id);
                const prev = previous(p.id);
                return (
                  <TableRow
                    key={p.id}
                    data-state={p.id === selected.id ? "selected" : undefined}
                    className="cursor-pointer"
                    onClick={() => select(p.id)}
                  >
                    <TableCell>
                      <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">
                        {i + 1}
                      </span>
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          select(p.id);
                        }}
                        className="rounded-sm text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        <span className="block font-medium">{p.name}</span>
                        <span className="block text-xs text-muted-foreground">{p.username}</span>
                      </button>
                    </TableCell>
                    {KPI_GROUPS.map((g) => (
                      <TableCell key={g} className="text-right tabular-nums">
                        {c.groups[g] == null ? <span className="text-muted-foreground">-</span> : fmtScore(c.groups[g])}
                      </TableCell>
                    ))}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <ScoreBar value={c.total} className="flex-1" />
                        <span className="w-12 text-right font-semibold tabular-nums">{fmtScore(c.total)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {prev ? <Delta value={c.total - prev.total} /> : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={kpiGrade(c.total)} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Content>
      )}

      <Content
        id="kpi-rapor"
        size="md"
        className="scroll-mt-20"
        title="Rapor KPI"
        description={`${selected.name} · ${formatPeriode(month)}`}
        cardAction={
          isManager && (
            <div className="w-48">
              <SearchableSelect value={selected.id} onValueChange={setSelectedId}>
                <SearchableSelectTrigger className="w-full">
                  <SearchableSelectValue placeholder="Pilih sales" />
                </SearchableSelectTrigger>
                <SearchableSelectContent>
                  {people.map((p) => (
                    <SearchableSelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SearchableSelectItem>
                  ))}
                </SearchableSelectContent>
              </SearchableSelect>
            </div>
          )
        }
      >
        <Report card={mine} prev={prevMine} />
      </Content>

      <Content size="md" title="Tren Skor" description={`${months.length} bulan terakhir hingga ${formatPeriode(month)}`}>
        <TrendChart
          data={months.map((m, i) => ({
            month: m,
            sales: cards[selected.id][i].total,
            ...(isManager && people.length > 1 ? { team: teamAvg(i) } : {}),
          }))}
          salesLabel={selected.name}
        />
      </Content>

      <Definitions />
    </>
  );
}

function SalesStat({ summary }: { summary: Props["summary"] }) {
  return (
    <StatCard
      label="Pencapaian Penjualan"
      value={summary.salesTarget ? fmtPercent(pct(summary.salesActual, summary.salesTarget)) : "-"}
      hint={
        summary.salesTarget
          ? `${fmtJuta(summary.salesActual, 1)} dari ${fmtJuta(summary.salesTarget, 1)}`
          : "Belum ada target forecast"
      }
      icon={Target}
    />
  );
}

function Delta({ value }: { value: number }) {
  const rounded = Math.round(value * 10) / 10;
  if (!rounded) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground tabular-nums">
        <Minus className="size-3.5" /> 0.0
      </span>
    );
  }
  const up = rounded > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={cn("inline-flex items-center gap-1 font-medium tabular-nums", up ? DELTA_TEXT.up : DELTA_TEXT.down)}>
      <Icon className="size-3.5" />
      {up ? "+" : ""}
      {fmtScore(rounded)}
    </span>
  );
}

/** Bar capaian 0–100% (lebih dari 100% tetap penuh), warna mengikuti predikat. */
function ScoreBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-muted", className)}>
      <div
        className={cn("h-full rounded-full", GRADE_BAR[kpiGrade(value)])}
        style={{ width: `${Math.max(0, Math.min(value, 100))}%` }}
      />
    </div>
  );
}

function Report({ card, prev }: { card: KpiCard; prev?: KpiCard }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2 rounded-lg border bg-muted/50 p-4 dark:bg-muted/10">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Skor Total</p>
          <p className="text-3xl font-semibold tracking-tight tabular-nums">{fmtScore(card.total)}</p>
        </div>
        <div className="flex flex-col items-start gap-1 pb-1">
          <StatusBadge value={kpiGrade(card.total)} />
          {prev && (
            <span className="text-xs text-muted-foreground">
              <Delta value={card.total - prev.total} /> vs {formatPeriode(prev.month)}
            </span>
          )}
        </div>
      </div>

      {KPI_GROUPS.map((g) => (
        <section key={g} className="space-y-3">
          <div className="flex items-baseline justify-between border-b pb-1.5">
            <h3 className="text-sm font-semibold">
              {g} <span className="font-normal text-muted-foreground">· bobot {groupWeight(g)}%</span>
            </h3>
            <span className="text-sm font-medium tabular-nums">
              {card.groups[g] == null ? "-" : fmtScore(card.groups[g])}
            </span>
          </div>
          <ul className="space-y-3">
            {KPI_DEFS.filter((d) => d.group === g).map((def) => (
              <KpiRow key={def.id} def={def} value={card.items.find((i) => i.id === def.id)!} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function KpiRow({ def, value }: { def: KpiDef; value: KpiValue }) {
  const na = value.achievement == null;
  return (
    <li className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 font-medium">{def.label}</span>
        <span className="shrink-0 tabular-nums">
          {na ? (
            <span className="text-muted-foreground">-</span>
          ) : (
            <>
              <span className="font-semibold">{fmtValue(def, value.actual)}</span>
              <span className="text-muted-foreground"> / {fmtTarget(def)}</span>
            </>
          )}
        </span>
      </div>
      {na ? (
        <div className="h-1.5 rounded-full border border-dashed" />
      ) : (
        <ScoreBar value={value.achievement!} />
      )}
      <div className="flex justify-between gap-3 text-xs text-muted-foreground">
        <span className="min-w-0 truncate" title={value.detail}>
          {na ? `${value.detail} — bobot dialihkan` : value.detail}
        </span>
        <span className="shrink-0 tabular-nums">
          {na ? `Bobot ${def.weight}%` : `Capaian ${fmtPercent(value.achievement!)} · Bobot ${def.weight}%`}
        </span>
      </div>
    </li>
  );
}

function TrendChart({
  data,
  salesLabel,
}: {
  data: { month: string; sales: number; team?: number }[];
  salesLabel: string;
}) {
  const withTeam = data.some((d) => d.team != null);
  const config = {
    sales: { label: salesLabel, color: "var(--chart-1)" },
    team: { label: "Rata-rata tim", color: "var(--chart-2)" },
  } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto h-72 w-full">
      <LineChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickFormatter={shortMonth} tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis domain={[0, KPI_CAP]} ticks={[0, 30, 60, 90, 120]} tickLine={false} axisLine={false} width={32} />
        <ReferenceLine
          y={KPI_GRADES[1].min}
          stroke="var(--muted-foreground)"
          strokeDasharray="4 4"
          strokeOpacity={0.6}
          label={{ value: `Baik (${KPI_GRADES[1].min})`, position: "insideTopRight", fontSize: 11, fill: "var(--muted-foreground)" }}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(m) => formatPeriode(String(m))}
              formatter={(v, name) => (
                <div className="flex w-full items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-[2px]" style={{ background: `var(--color-${name})` }} />
                  <span className="text-muted-foreground">{config[name as keyof typeof config]?.label}</span>
                  <span className="ml-auto font-mono font-medium text-foreground tabular-nums">{fmtScore(Number(v))}</span>
                </div>
              )}
            />
          }
        />
        {withTeam && <ChartLegend content={<ChartLegendContent />} />}
        {withTeam && (
          <Line
            dataKey="team"
            type="monotone"
            stroke="var(--color-team)"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={{ r: 4, fill: "var(--color-team)", stroke: "var(--color-card)", strokeWidth: 2 }}
            activeDot={{ r: 5 }}
          />
        )}
        <Line
          dataKey="sales"
          type="monotone"
          stroke="var(--color-sales)"
          strokeWidth={2}
          dot={{ r: 4, fill: "var(--color-sales)", stroke: "var(--color-card)", strokeWidth: 2 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ChartContainer>
  );
}

function Definitions() {
  const total = KPI_DEFS.reduce((a, d) => a + d.weight, 0);
  return (
    <Content
      title="Definisi KPI"
      description="Usulan awal — dihitung otomatis dari data menu sumber, tanpa input tambahan"
    >
      <div className="space-y-4">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-muted-foreground">KPI</TableHead>
              <TableHead className="text-muted-foreground">Kelompok</TableHead>
              <TableHead className="text-muted-foreground">Rumus</TableHead>
              <TableHead className="text-muted-foreground">Sumber Data</TableHead>
              <TableHead className="text-right text-muted-foreground">Target / Bulan</TableHead>
              <TableHead className="text-right text-muted-foreground">Bobot</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {KPI_DEFS.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.label}</TableCell>
                <TableCell>{d.group}</TableCell>
                <TableCell className="min-w-64 whitespace-normal text-muted-foreground">{d.formula}</TableCell>
                <TableCell>{d.source}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtTarget(d)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{d.weight}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={5} className="text-right">
                Total bobot
              </TableCell>
              <TableCell className="text-right tabular-nums">{total}%</TableCell>
            </TableRow>
          </TableFooter>
        </Table>

        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Capaian per KPI = realisasi ÷ target, dibatasi maksimal {KPI_CAP}%.</li>
          <li>
            Skor total = rata-rata capaian tertimbang bobot. KPI yang belum punya data di periode itu (mis. belum ada
            target forecast) tidak dihitung, dan bobotnya dibagi ke KPI lain.
          </li>
          <li>
            Predikat:{" "}
            {KPI_GRADES.map((g, i) => (
              <span key={g.label}>
                <span className="font-medium text-foreground">{g.label}</span>{" "}
                {i === 0
                  ? `≥ ${g.min}`
                  : i === KPI_GRADES.length - 1
                    ? `< ${KPI_GRADES[i - 1].min}`
                    : `${g.min}–${fmtScore(KPI_GRADES[i - 1].min - 0.1)}`}
                {i < KPI_GRADES.length - 1 ? " · " : ""}
              </span>
            ))}
            .
          </li>
          <li>Periode bulanan mengikuti WIB. Sales hanya melihat KPI miliknya sendiri.</li>
        </ul>
      </div>
    </Content>
  );
}
