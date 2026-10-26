"use client";

import { Activity, Building2, FileText, MapPin, Percent, Rocket, Target, Trophy } from "lucide-react";
import { Content } from "@/components/content";
import { HBars, Meter, QUOT_COLORS, StackedBars, TargetActualChart, VIZ } from "@/components/insights/charts";
import { useInsights } from "@/components/insights/provider";
import { RankTable } from "@/components/insights/rank-table";
import { Delta, Tile } from "@/components/insights/tile";
import { fmtNumber, fmtPercent, fmtRpShort, fmtRupiah } from "@/lib/format";
import type { AnalyticsData, SalesRank } from "@/lib/insights/types";
import { lastDayOf, type Granularity } from "@/lib/period";
import type { PipelineStage } from "@/lib/constants";
import type { WidgetSize } from "@/lib/prefs";

type S = { data: AnalyticsData; size: WidgetSize };

const sizeOf = (s: WidgetSize) => (s === "half" ? "md" : "lg");
const monthRange = (m: string) => ({ from: `${m}-01`, to: lastDayOf(m) });
const bucketHint: Record<Granularity, string> = { hour: "per jam", day: "per hari", week: "per minggu", month: "per bulan" };

// ---------------------------------------------------------------------------
export function SummarySection({ data }: S) {
  const { openDrill } = useInsights();
  const s = data.summary;
  const ach = s.target.cur ? (s.actual.cur / s.target.cur) * 100 : null;
  return (
    <>
      <Tile
        label="Actual Penjualan"
        value={fmtRpShort(s.actual.cur)}
        icon={Target}
        delta={<Delta cur={s.actual.cur} prev={s.actual.prev} />}
        hint={ach == null ? "Tanpa target" : `ACH ${fmtPercent(ach)} dari ${fmtRpShort(s.target.cur)}`}
        onClick={() => openDrill({ kind: "forecast", title: "Actual Penjualan" })}
      />
      <Tile
        label="Nilai Quotation"
        value={fmtRpShort(s.quotation.cur)}
        icon={FileText}
        delta={<Delta cur={s.quotation.cur} prev={s.quotation.prev} />}
        onClick={() => openDrill({ kind: "quotation_items", title: "Barang Quotation" })}
      />
      <Tile
        label="Win Rate Quotation"
        value={s.winRate.cur == null ? "–" : fmtPercent(s.winRate.cur)}
        icon={Percent}
        delta={<Delta cur={s.winRate.cur} prev={s.winRate.prev} mode="points" />}
        hint="Win ÷ (Win + Loss), per barang"
        onClick={() => openDrill({ kind: "quotation_items", title: "Barang Quotation Win", filter: { status: "Win" } })}
      />
      <Tile
        label="Deal Good Receive"
        value={fmtRpShort(s.won.cur)}
        icon={Trophy}
        delta={<Delta cur={s.won.cur} prev={s.won.prev} />}
        hint={`${fmtNumber(s.wonCount.cur)} deal (lalu ${fmtNumber(s.wonCount.prev)})`}
        onClick={() => openDrill({ kind: "won", title: "Deal Good Receive" })}
      />
      <Tile
        label="Deal Baru"
        value={fmtNumber(s.newDeals.cur)}
        icon={Rocket}
        delta={<Delta cur={s.newDeals.cur} prev={s.newDeals.prev} />}
        onClick={() => openDrill({ kind: "deals_new", title: "Deal Baru" })}
      />
      <Tile
        label="Aktivitas Sales"
        value={fmtNumber(s.activities.cur)}
        icon={Activity}
        delta={<Delta cur={s.activities.cur} prev={s.activities.prev} />}
        onClick={() => openDrill({ kind: "activities", title: "Sales Daily Activity" })}
      />
      <Tile
        label="Visit Customer"
        value={fmtNumber(s.visits.cur)}
        icon={MapPin}
        delta={<Delta cur={s.visits.cur} prev={s.visits.prev} />}
        hint="Visit & Meeting selesai"
        onClick={() => openDrill({ kind: "activities", title: "Visit Customer", filter: { visit: true, status: "Completed" } })}
      />
      <Tile
        label="Customer Baru"
        value={fmtNumber(s.customers.cur)}
        icon={Building2}
        delta={<Delta cur={s.customers.cur} prev={s.customers.prev} />}
        onClick={() => openDrill({ kind: "customers_new", title: "Customer Baru" })}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
export function SalesTrendSection({ data, size }: S) {
  const { openDrill } = useInsights();
  const months = data.salesTrend;
  // satu bulan → bukan grafik, cukup angka + meter
  if (months.length < 2) {
    const m = months[0];
    const ach = m?.target ? (m.actual / m.target) * 100 : null;
    return (
      <Content size={sizeOf(size)} title="Penjualan per Bulan" description="Periode ini berada dalam satu bulan forecast">
        <button
          type="button"
          onClick={() => m && openDrill({ kind: "forecast", title: `Forecast ${m.label}`, range: monthRange(m.month) })}
          className="grid grid-cols-1 w-full gap-3 rounded-lg border p-4 text-left hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground">Forecast {m?.label ?? "-"}</p>
              <p className="text-3xl font-semibold tracking-tight">{ach == null ? "–" : fmtPercent(ach)}</p>
            </div>
            <p className="text-sm">
              <span className="font-medium">{fmtRupiah(m?.actual ?? 0)}</span>
              <span className="text-muted-foreground"> dari {fmtRupiah(m?.target ?? 0)}</span>
            </p>
          </div>
          <Meter value={ach} />
        </button>
      </Content>
    );
  }
  return (
    <Content size={sizeOf(size)} title="Penjualan per Bulan" description="Target vs Actual Sales Forecast · klik bulan untuk rincian">
      <TargetActualChart
        data={months.map((m) => ({ label: m.label, target: m.target, actual: m.actual }))}
        onSelect={(i) => openDrill({ kind: "forecast", title: `Forecast ${months[i].label}`, range: monthRange(months[i].month) })}
      />
    </Content>
  );
}

const ACT_SERIES = [
  { key: "Completed", label: "Completed", color: VIZ[0] },
  { key: "In Progress", label: "In Progress", color: VIZ[2] },
  { key: "Pending", label: "Pending", color: VIZ[1] },
];

export function ActivityTrendSection({ data, size }: S) {
  const { openDrill } = useInsights();
  const { rows, granularity } = data.activityTrend;
  return (
    <Content size={sizeOf(size)} title="Tren Aktivitas Sales" description={`Jumlah aktivitas ${bucketHint[granularity]} per status`}>
      <StackedBars
        data={rows}
        series={ACT_SERIES}
        onSelect={(i) => openDrill({ kind: "activities", title: "Sales Daily Activity", range: { from: rows[i].from, to: rows[i].to } })}
      />
    </Content>
  );
}

const QUOT_SERIES = [
  { key: "Win", label: "Win", color: QUOT_COLORS.Win },
  { key: "Open", label: "Draft/Negosiasi", color: QUOT_COLORS.Open },
  { key: "Loss", label: "Loss", color: QUOT_COLORS.Loss },
  { key: "Cancel", label: "Cancel", color: QUOT_COLORS.Cancel },
];

export function QuotationTrendSection({ data, size }: S) {
  const { openDrill } = useInsights();
  const { rows, granularity } = data.quotationTrend;
  return (
    <Content size={sizeOf(size)} title="Tren Quotation" description={`Nilai barang quotation ${bucketHint[granularity]} per status`}>
      <StackedBars
        data={rows}
        series={QUOT_SERIES}
        money
        onSelect={(i) => openDrill({ kind: "quotation_items", title: "Barang Quotation", range: { from: rows[i].from, to: rows[i].to } })}
      />
    </Content>
  );
}

// ---------------------------------------------------------------------------
export function TopSalesSection({ data, size }: S) {
  const { openDrill, filter } = useInsights();
  return (
    <Content size={sizeOf(size)} title="Peringkat Sales" description="Klik baris untuk rincian forecast sales · klik header untuk mengurutkan">
      <div className="-mx-2 overflow-x-auto">
        <RankTable<SalesRank>
          rows={data.topSales}
          rowKey={(r) => r.id}
          defaultSort="actual"
          highlight={(r) => r.id === filter.sales}
          onRow={(r) => openDrill({ kind: "forecast", title: `Forecast · ${r.name}`, sales: r.id })}
          empty="Belum ada akun Sales aktif"
          columns={[
            { key: "name", header: "Sales", value: (r) => r.name, render: (r) => <span className="font-medium">{r.name}</span> },
            { key: "actual", header: "Actual", numeric: true, value: (r) => r.actual, render: (r) => fmtRpShort(r.actual) },
            { key: "target", header: "Target", numeric: true, value: (r) => r.target, render: (r) => fmtRpShort(r.target) },
            {
              key: "ach",
              header: "ACH",
              value: (r) => r.ach,
              className: "min-w-36",
              render: (r) => (
                <div className="flex items-center gap-2">
                  <Meter value={r.ach} className="h-1.5" />
                  <span className="w-12 shrink-0 text-right text-xs tabular-nums">{r.ach == null ? "–" : fmtPercent(r.ach)}</span>
                </div>
              ),
            },
            { key: "winRate", header: "Win Rate", numeric: true, value: (r) => r.winRate, render: (r) => (r.winRate == null ? "–" : fmtPercent(r.winRate)) },
            { key: "wonValue", header: "Deal GR", numeric: true, value: (r) => r.wonValue, render: (r) => `${fmtNumber(r.won)} · ${fmtRpShort(r.wonValue)}` },
            { key: "newDeals", header: "Deal Baru", numeric: true, value: (r) => r.newDeals, render: (r) => fmtNumber(r.newDeals) },
            { key: "activities", header: "Aktivitas", numeric: true, value: (r) => r.activities, render: (r) => fmtNumber(r.activities) },
            { key: "visits", header: "Visit", numeric: true, value: (r) => r.visits, render: (r) => fmtNumber(r.visits) },
            { key: "customers", header: "Cust. Baru", numeric: true, value: (r) => r.customers, render: (r) => fmtNumber(r.customers) },
          ]}
        />
      </div>
    </Content>
  );
}

export function TopCustomersSection({ data, size }: S) {
  const { openDrill } = useInsights();
  const n = data.prefs.topN;
  return (
    <Content size={sizeOf(size)} title="Top Customer" description={`${n} customer dengan Actual penjualan tertinggi`}>
      <div className="-mx-2 overflow-x-auto">
        <RankTable
          rows={data.topCustomers}
          limit={n}
          rowKey={(r) => r.id}
          defaultSort="actual"
          onRow={(r) => openDrill({ kind: "forecast", title: `Forecast · ${r.name}`, filter: { customer: r.id } })}
          columns={[
            {
              key: "name",
              header: "Customer",
              value: (r) => r.name,
              render: (r) => (
                <span className="block max-w-56">
                  <span className="block truncate font-medium" title={r.name}>
                    {r.name}
                  </span>
                  {r.code && <span className="block font-mono text-xs text-muted-foreground">{r.code}</span>}
                </span>
              ),
            },
            { key: "actual", header: "Actual", numeric: true, value: (r) => r.actual, render: (r) => fmtRpShort(r.actual) },
            {
              key: "ach",
              header: "ACH",
              numeric: true,
              value: (r) => (r.target ? r.actual / r.target : null),
              render: (r) => (r.target ? fmtPercent((r.actual / r.target) * 100) : "–"),
            },
            { key: "quotWin", header: "Quot. Win", numeric: true, value: (r) => r.quotWin, render: (r) => fmtRpShort(r.quotWin) },
          ]}
        />
      </div>
    </Content>
  );
}

export function TopPartsSection({ data, size }: S) {
  const { openDrill } = useInsights();
  const n = data.prefs.topN;
  return (
    <Content size={sizeOf(size)} title="Top Sparepart" description={`${n} part dengan Actual Qty tertinggi`}>
      <div className="-mx-2 overflow-x-auto">
        <RankTable
          rows={data.topParts}
          limit={n}
          rowKey={(r) => r.part}
          defaultSort="qty"
          onRow={(r) => openDrill({ kind: "forecast", title: `Forecast · ${r.part}`, subtitle: r.name ?? undefined, filter: { part: r.part } })}
          columns={[
            {
              key: "part",
              header: "Part",
              value: (r) => r.part,
              render: (r) => (
                <span className="block max-w-56">
                  <span className="block truncate font-mono text-xs" title={r.part}>
                    {r.part}
                  </span>
                  {r.name && (
                    <span className="line-clamp-2 text-xs wrap-break-word whitespace-normal text-muted-foreground" title={r.name}>
                      {r.name}
                    </span>
                  )}
                </span>
              ),
            },
            { key: "qty", header: "Actual Qty", numeric: true, value: (r) => r.qty, render: (r) => fmtNumber(r.qty) },
            { key: "rp", header: "Actual Rp", numeric: true, value: (r) => r.rp, render: (r) => fmtRpShort(r.rp) },
          ]}
        />
      </div>
    </Content>
  );
}

// ---------------------------------------------------------------------------
export function KategoriSection({ data, size }: S) {
  const { openDrill } = useInsights();
  const rows = data.kategori;
  const pipe = data.pipelineKategori;
  return (
    <Content size={sizeOf(size)} title="Kategori" description="Forecast per kategori part · pipeline per kategori deal">
      <div className="grid grid-cols-1 gap-5">
        <TargetActualChart
          height={240}
          data={rows.map((r) => ({ label: r.kategori, target: r.target, actual: r.actual }))}
          onSelect={(i) => openDrill({ kind: "forecast", title: `Forecast · ${rows[i].kategori}`, filter: { kategori: rows[i].kategori } })}
        />
        {pipe.length > 0 && (
          <div className="grid grid-cols-1 gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">Pipeline per kategori</p>
            {pipe.map((p) => (
              <button
                key={p.kategori}
                type="button"
                onClick={() => openDrill({ kind: "pipeline", title: `Pipeline · ${p.kategori}`, subtitle: "Deal berjalan (posisi saat ini)", filter: { kategori: p.kategori } })}
                className="flex items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className="min-w-0 flex-1 truncate">{p.kategori}</span>
                <span className="text-xs text-muted-foreground">{fmtNumber(p.openCount)} berjalan</span>
                <span className="w-20 text-right font-medium tabular-nums">{fmtRpShort(p.open)}</span>
                <span className="w-24 text-right text-xs text-muted-foreground tabular-nums">GR {fmtRpShort(p.won)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Content>
  );
}

export function ConversionSection({ data, size }: S) {
  const { openDrill } = useInsights();
  const c = data.conversion;
  const stat = (label: string, value: string, hint?: string) => (
    <div className="rounded-lg bg-muted/50 px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-base font-semibold">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
  return (
    <Content size={sizeOf(size)} title="Konversi Pipeline" description="Deal yang dibuat di periode ini & posisinya sekarang">
      <div className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stat("Deal baru", fmtNumber(c.newDeals), fmtRpShort(c.newValue))}
          {stat("Sampai PO+", fmtNumber(c.reachedPo), c.newDeals ? fmtPercent((c.reachedPo / c.newDeals) * 100) : undefined)}
          {stat("Siklus rata-rata", c.cycleDays == null ? "–" : `${fmtNumber(Math.round(c.cycleDays))} hari`, "dibuat → Good Receive")}
          {stat("Rata-rata deal GR", c.avgWonValue == null ? "–" : fmtRpShort(c.avgWonValue), `${fmtNumber(c.won)} deal GR`)}
        </div>
        <HBars
          data={c.byStage.map((s) => ({ name: s.stage, value: s.count, sub: fmtRupiah(s.value) }))}
          label="Deal"
          onSelect={(i) =>
            openDrill({ kind: "deals_new", title: `Deal Baru · ${c.byStage[i].stage}`, filter: { stage: c.byStage[i].stage as PipelineStage } })
          }
        />
      </div>
    </Content>
  );
}

export function ActivityTypesSection({ data, size }: S) {
  const { openDrill } = useInsights();
  const rows = data.activityTypes;
  return (
    <Content size={sizeOf(size)} title="Aktivitas per Tipe" description="Jumlah Sales Daily Activity · klik untuk rincian">
      <HBars
        data={rows.map((r) => ({ name: r.type, value: r.count, sub: `${fmtNumber(r.completed)} selesai` }))}
        label="Aktivitas"
        color={VIZ[0]}
        onSelect={(i) => openDrill({ kind: "activities", title: `Aktivitas · ${rows[i].type}`, filter: { type: rows[i].type } })}
      />
    </Content>
  );
}
