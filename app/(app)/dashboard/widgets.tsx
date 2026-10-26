"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileCog,
  FileText,
  GraduationCap,
  Hourglass,
  Kanban,
  MapPin,
  Percent,
  Target,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import { Content } from "@/components/content";
import { StatusBadge } from "@/components/entity/status-badge";
import { useOnlineUsers } from "@/components/layout/presence-provider";
import { Donut, HBars, Meter, QUOT_COLORS, TargetActualChart, TrendLines, VIZ } from "@/components/insights/charts";
import { useInsights } from "@/components/insights/provider";
import { Delta, Tile } from "@/components/insights/tile";
import { buttonVariants } from "@/components/ui/button";
import { fmtNumber, fmtPercent, fmtRpShort, fmtRupiah } from "@/lib/format";
import { AGENDA_META, AGENDA_ORDER } from "@/lib/insights/agenda";
import type { AgendaId, DashboardData } from "@/lib/insights/types";
import { PIPELINE_PROGRESS, type PipelineStage } from "@/lib/constants";
import { lastDayOf, periodQuery, rangeLabel, type Granularity } from "@/lib/period";
import { TONE } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { WidgetSize } from "@/lib/prefs";

type W = { data: DashboardData; size: WidgetSize };

const monthRange = (m: string) => ({ from: `${m}-01`, to: lastDayOf(m) });
const monthsLabel = (months: string[]) => rangeLabel({ from: `${months[0]}-01`, to: lastDayOf(months[months.length - 1]) });
const sizeOf = (s: WidgetSize) => (s === "half" ? "md" : "lg");

const WIB_TIME = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const bucketHint: Record<Granularity, string> = { hour: "per jam", day: "per hari", week: "per minggu", month: "per bulan" };

// ---------------------------------------------------------------------------
// Capaian penjualan (hero)
// ---------------------------------------------------------------------------
export function HeroWidget({ data }: W) {
  const { openDrill } = useInsights();
  const { hero, filter } = data;
  const { period } = filter;
  const target = hero.target.cur;
  const actual = hero.actual.cur;
  const ach = target ? (actual / target) * 100 : null;
  const gap = Math.max(0, target - actual);
  const perDay = hero.daysLeft != null && hero.daysLeft > 0 && gap > 0 ? gap / (hero.daysLeft + 1) : null;
  const label = monthsLabel(period.months);
  const sameMonths = period.months.join() === period.prevMonths.join();

  return (
    <button
      type="button"
      onClick={() => openDrill({ kind: "forecast", title: "Capaian Penjualan", subtitle: `Forecast ${label}` })}
      className="group col-span-12 grid grid-cols-1 gap-5 rounded-xl border bg-card p-5 text-left text-card-foreground shadow-sm transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:p-6"
    >
      <div className="min-w-0 space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Target className="size-4 text-primary" />
          Capaian penjualan · Forecast {label}
        </div>
        <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
          <p className="text-5xl font-semibold tracking-tight">{ach == null ? "–" : fmtPercent(ach)}</p>
          <div className="pb-1.5 text-sm">
            <span className="font-medium">{fmtRpShort(actual)}</span>
            <span className="text-muted-foreground"> dari target {fmtRpShort(target)}</span>
          </div>
        </div>
        <Meter value={ach} className="h-2.5" />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {!sameMonths && (
            <span className="inline-flex items-center gap-1.5">
              <Delta cur={actual} prev={hero.actual.prev} /> vs {monthsLabel(period.prevMonths)} ({fmtRpShort(hero.actual.prev)})
            </span>
          )}
          {!target && <span>Belum ada target forecast di periode ini</span>}
          <span className="ml-auto inline-flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            Lihat rincian <ArrowRight className="size-3.5" />
          </span>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3 self-center sm:grid-cols-3 md:grid-cols-2">
        <Fact label="Sisa target" value={gap ? fmtRpShort(gap) : target ? "Tercapai" : "–"} />
        <Fact label="Sisa hari bulan ini" value={hero.daysLeft != null ? `${hero.daysLeft} hari` : "–"} />
        <Fact label="Perlu per hari" value={perDay ? fmtRpShort(perDay) : "–"} hint={perDay ? "untuk kejar target" : undefined} />
        <Fact label="Target periode lalu" value={sameMonths ? "–" : fmtRpShort(hero.target.prev)} />
      </dl>
    </button>
  );
}

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-base font-semibold">{value}</dd>
      {hint && <dd className="text-[11px] text-muted-foreground">{hint}</dd>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Kartu statistik
// ---------------------------------------------------------------------------
function OnlineTile() {
  const users = useOnlineUsers();
  const names = users.map((u) => u.name || u.username);
  return (
    <Tile
      label="Akun Online"
      value={fmtNumber(users.length)}
      icon={Users}
      hint={names.length ? names.slice(0, 3).join(", ") + (names.length > 3 ? ` +${names.length - 3}` : "") : "Akun aktif saat ini"}
    />
  );
}

export function StatsWidget({ data }: W) {
  const { openDrill } = useInsights();
  const t = data.tiles;
  const tiles: Record<string, React.ReactNode> = {
    pipeline: (
      <Tile
        label="Pipeline Aktif"
        value={fmtRpShort(t.pipeline.value)}
        icon={Wallet}
        hint={`${fmtNumber(t.pipeline.count)} deal berjalan · ${fmtNumber(t.pipeline.newDeals)} baru`}
        onClick={() => openDrill({ kind: "pipeline", title: "Pipeline Aktif", subtitle: "Deal yang belum Good Receive (posisi saat ini)" })}
      />
    ),
    won: (
      <Tile
        label="Deal Good Receive"
        value={fmtRpShort(t.won.cur)}
        icon={Trophy}
        delta={<Delta cur={t.won.cur} prev={t.won.prev} />}
        hint={`${fmtNumber(t.won.count)} deal`}
        onClick={() => openDrill({ kind: "won", title: "Deal Good Receive" })}
      />
    ),
    quotation: (
      <Tile
        label="Nilai Quotation"
        value={fmtRpShort(t.quotation.cur)}
        icon={FileText}
        delta={<Delta cur={t.quotation.cur} prev={t.quotation.prev} />}
        hint={`${fmtNumber(t.quotation.quotations)} quotation · ${fmtNumber(t.quotation.items)} barang`}
        onClick={() => openDrill({ kind: "quotation_items", title: "Barang Quotation" })}
      />
    ),
    win_rate: (
      <Tile
        label="Win Rate Quotation"
        value={t.winRate.cur == null ? "–" : fmtPercent(t.winRate.cur)}
        icon={Percent}
        delta={<Delta cur={t.winRate.cur} prev={t.winRate.prev} mode="points" />}
        hint={`Win ${fmtRpShort(t.winRate.winValue)}`}
        onClick={() => openDrill({ kind: "quotation_items", title: "Barang Quotation Win", filter: { status: "Win" } })}
      />
    ),
    activities: (
      <Tile
        label="Aktivitas Sales"
        value={fmtNumber(t.activities.cur)}
        icon={Activity}
        delta={<Delta cur={t.activities.cur} prev={t.activities.prev} />}
        hint={t.activities.cur ? `${fmtPercent((t.activities.completed / t.activities.cur) * 100)} selesai` : undefined}
        onClick={() => openDrill({ kind: "activities", title: "Sales Daily Activity" })}
      />
    ),
    visits: (
      <Tile
        label="Visit Customer"
        value={fmtNumber(t.visits.cur)}
        icon={MapPin}
        delta={<Delta cur={t.visits.cur} prev={t.visits.prev} />}
        hint="Visit & Meeting selesai"
        onClick={() => openDrill({ kind: "activities", title: "Visit Customer", filter: { visit: true, status: "Completed" } })}
      />
    ),
    customers: (
      <Tile
        label="Customer Baru"
        value={fmtNumber(t.customers.cur)}
        icon={Building2}
        delta={<Delta cur={t.customers.cur} prev={t.customers.prev} />}
        onClick={() => openDrill({ kind: "customers_new", title: "Customer Baru" })}
      />
    ),
    online: <OnlineTile />,
  };
  return (
    <>
      {data.prefs.tiles
        .filter((x) => x.visible)
        .map((x) => (
          <Fragment key={x.id}>{tiles[x.id]}</Fragment>
        ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Perlu tindak lanjut ("plan list" harian)
// ---------------------------------------------------------------------------
const AGENDA_ICON: Record<AgendaId, typeof FileText> = {
  quot_expired: AlertTriangle,
  quot_expiring: Hourglass,
  forecast_risk: Target,
  deal_stale: Kanban,
  act_pending: ClipboardList,
  admin_pending: FileCog,
  refreshment_upcoming: GraduationCap,
};

export function AgendaWidget({ data, size }: W) {
  const { openDrill } = useInsights();
  const items = AGENDA_ORDER.map((id) => data.agenda.find((a) => a.id === id)!).filter(Boolean);
  const open = items.filter((a) => a.count);
  const total = open.reduce((s, a) => s + a.count, 0);
  return (
    <Content
      size={sizeOf(size)}
      title="Perlu Tindak Lanjut"
      description={total ? `${fmtNumber(total)} hal menunggu · posisi hari ini` : "Posisi hari ini, tidak ikut filter periode"}
    >
      {!open.length ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
          <CheckCircle2 className="size-7 text-[var(--viz-good)]" />
          Tidak ada yang perlu ditindaklanjuti. Mantap!
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-1.5">
          {items.map((a) => {
            const meta = AGENDA_META[a.id];
            const Icon = AGENDA_ICON[a.id];
            return (
              <li key={a.id}>
                <button
                  type="button"
                  disabled={!a.count}
                  onClick={() => openDrill({ kind: a.id, title: meta.label, subtitle: meta.hint, range: { from: data.filter.period.today, to: data.filter.period.today } })}
                  className="flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:border-dashed disabled:opacity-55"
                >
                  <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md border", a.count ? TONE[meta.tone] : TONE.gray)}>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{meta.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {a.value ? `${fmtRpShort(a.value)} · ` : ""}
                      {meta.hint}
                    </span>
                  </span>
                  <span className="text-lg font-semibold tabular-nums">{fmtNumber(a.count)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Content>
  );
}

// ---------------------------------------------------------------------------
// Grafik
// ---------------------------------------------------------------------------
export function SalesTrendWidget({ data, size }: W) {
  const { openDrill } = useInsights();
  const { months, extended } = data.salesTrend;
  return (
    <Content
      size={sizeOf(size)}
      title="Tren Penjualan"
      description={
        extended
          ? `Target vs Actual ${months.length} bulan terakhir · periode terpilih ditebalkan · klik bulan untuk rincian`
          : "Target vs Actual per bulan · klik bulan untuk rincian"
      }
    >
      <TargetActualChart
        data={months.map((m) => ({ label: m.label, target: m.target, actual: m.actual, dim: !m.inRange }))}
        onSelect={(i) => openDrill({ kind: "forecast", title: `Forecast ${months[i].label}`, range: monthRange(months[i].month) })}
      />
    </Content>
  );
}

const ACTIVITY_SERIES = [
  { key: "sales", label: "Aktivitas Sales", color: VIZ[0] },
  { key: "admin", label: "Aktivitas Admin", color: VIZ[1] },
  { key: "quotation", label: "Quotation", color: VIZ[2] },
  { key: "deals", label: "Deal Baru", color: VIZ[3] },
];

export function ActivityTrendWidget({ data, size }: W) {
  const { openDrill } = useInsights();
  const { rows, granularity } = data.activityTrend;
  return (
    <Content
      size={sizeOf(size)}
      title="Volume Aktivitas"
      description={`Jumlah ${bucketHint[granularity]} · klik titik untuk lihat aktivitas sales`}
    >
      <TrendLines
        data={rows}
        series={ACTIVITY_SERIES}
        onSelect={(i) =>
          openDrill({
            kind: "activities",
            title: "Sales Daily Activity",
            range: { from: rows[i].from, to: rows[i].to },
          })
        }
      />
    </Content>
  );
}

export function FunnelWidget({ data, size }: W) {
  const { openDrill } = useInsights();
  const [by, setBy] = useState<"count" | "value">("count");
  const rows = data.funnel;
  return (
    <Content
      size={sizeOf(size)}
      title="Pipeline per Stage"
      description="Posisi deal saat ini · klik stage untuk lihat deal"
      cardAction={
        <div className="flex rounded-md border p-0.5" role="radiogroup" aria-label="Ukuran">
          {(["count", "value"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={by === k}
              onClick={() => setBy(k)}
              className={cn("rounded px-2 py-0.5 text-xs text-muted-foreground", by === k && "bg-accent font-medium text-foreground")}
            >
              {k === "count" ? "Jumlah" : "Nilai"}
            </button>
          ))}
        </div>
      }
    >
      <HBars
        data={rows.map((r) => ({
          name: r.stage,
          value: by === "count" ? r.count : r.value,
          sub: `${PIPELINE_PROGRESS[r.stage as PipelineStage]}% · ${by === "count" ? fmtRupiah(r.value) : `${fmtNumber(r.count)} deal`}`,
        }))}
        format={by === "count" ? fmtNumber : fmtRpShort}
        label={by === "count" ? "Deal" : "Nilai"}
        onSelect={(i) => openDrill({ kind: "pipeline", title: `Pipeline · ${rows[i].stage}`, filter: { stage: rows[i].stage as PipelineStage } })}
      />
    </Content>
  );
}

export function QuotationWidget({ data, size }: W) {
  const { openDrill } = useInsights();
  const rows = data.quotation;
  const total = rows.reduce((a, r) => a + r.count, 0);
  return (
    <Content size={sizeOf(size)} title="Status Quotation" description="Barang quotation per status negosiasi · klik untuk rincian">
      <Donut
        data={rows.map((r) => ({ name: r.status, count: r.count, value: r.value, color: QUOT_COLORS[r.status] }))}
        center={fmtNumber(total)}
        centerLabel="Barang"
        onSelect={(i) => openDrill({ kind: "quotation_items", title: `Barang Quotation · ${rows[i].status}`, filter: { status: rows[i].status } })}
      />
    </Content>
  );
}

export function KategoriWidget({ data, size }: W) {
  const { openDrill } = useInsights();
  const rows = data.kategori;
  return (
    <Content size={sizeOf(size)} title="Forecast per Kategori" description={`Target vs Actual · ${monthsLabel(data.filter.period.months)}`}>
      <TargetActualChart
        data={rows.map((r) => ({ label: r.kategori, target: r.target, actual: r.actual }))}
        onSelect={(i) => openDrill({ kind: "forecast", title: `Forecast · ${rows[i].kategori}`, filter: { kategori: rows[i].kategori } })}
      />
    </Content>
  );
}

// ---------------------------------------------------------------------------
// Peringkat sales
// ---------------------------------------------------------------------------
export function LeaderboardWidget({ data, size }: W) {
  const { openDrill, viewer, filter } = useInsights();
  const rows = data.leaderboard.slice(0, 5);
  const { period } = filter;
  // "Hari ini" tidak ada di Analytics → pakai periode default Analytics
  const q = period.preset === "today" ? new URLSearchParams() : periodQuery(period.preset, period.offset, period.range);
  if (filter.sales) q.set("sales", filter.sales);
  return (
    <Content
      size={sizeOf(size)}
      title="Peringkat Sales"
      description="Actual penjualan tertinggi · klik nama untuk rincian"
      cardAction={
        viewer.menus.includes("analytics") ? (
          <Link href={`/analytics${q.size ? `?${q}` : ""}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Lihat semua
          </Link>
        ) : undefined
      }
    >
      {!rows.length ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Belum ada akun Sales aktif</p>
      ) : (
        <ol className="grid grid-cols-1 gap-1">
          {rows.map((r, i) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => openDrill({ kind: "forecast", title: `Forecast · ${r.name}`, sales: r.id })}
                className={cn(
                  "grid w-full grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-lg px-2 py-2 text-left hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  filter.sales === r.id && "bg-accent",
                )}
              >
                <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">{i + 1}</span>
                <span className="truncate text-sm font-medium">{r.name}</span>
                <span className="text-sm font-semibold">{fmtRpShort(r.actual)}</span>
                <span />
                <Meter value={r.ach} className="h-1.5" />
                <span className="text-xs text-muted-foreground tabular-nums">
                  {r.ach == null ? "Tanpa target" : `ACH ${fmtPercent(r.ach)}`}
                </span>
                <span />
                <span className="col-span-2 text-xs text-muted-foreground">
                  {fmtNumber(r.activities)} aktivitas · {fmtNumber(r.won)} deal GR · win rate {r.winRate == null ? "–" : fmtPercent(r.winRate)}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </Content>
  );
}

// ---------------------------------------------------------------------------
// Aktivitas terbaru
// ---------------------------------------------------------------------------
const RECENT_ICON = { activity: ClipboardList, move: Kanban, quotation: FileText, customer: Building2 } as const;

export function RecentWidget({ data, size }: W) {
  const rows = data.recent;
  return (
    <Content size={sizeOf(size)} title="Aktivitas Terbaru" description="Kegiatan terakhir di periode ini">
      {!rows.length ? (
        <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
          <CalendarClock className="size-6" />
          Belum ada aktivitas di periode ini
        </div>
      ) : (
        <ol className="relative grid grid-cols-1 gap-0.5 before:absolute before:top-3 before:bottom-3 before:left-[15px] before:w-px before:bg-border">
          {rows.map((r) => {
            const Icon = RECENT_ICON[r.kind];
            const body = (
              <>
                <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border bg-card text-muted-foreground">
                  <Icon className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium" title={r.title}>
                    {r.title}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {r.subtitle}
                    {r.who ? ` · ${r.who}` : ""} · {WIB_TIME.format(new Date(r.at))}
                  </span>
                </span>
                {r.status && <StatusBadge value={r.status} className="shrink-0" />}
              </>
            );
            return (
              <li key={r.id}>
                {r.href ? (
                  <Link href={r.href} className="flex items-center gap-3 rounded-lg py-1.5 pr-2 hover:bg-accent">
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 py-1.5 pr-2">{body}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Content>
  );
}
