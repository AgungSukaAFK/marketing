/** Agregasi murni atas Dataset (tanpa I/O) — dipakai Dashboard & Analytics. */
import { OPTIONS, PIPELINE_STAGES, stageProgress } from "@/lib/constants";
import { VISIT_TYPES } from "@/lib/kpi";
import { buckets, bucketKey, daysBetween, fmtMonthShort, inRange, type DateRange, type Granularity } from "@/lib/period";
import type { ActRow, Dataset, DealRow, FcRow, QuotRow } from "./load";
import type { KategoriRow, MonthRow, Person, SalesRank, StageRow, StatusRow, TrendBucket } from "./types";

export const sum = <T>(rows: T[], f: (r: T) => number) => rows.reduce((a, r) => a + f(r), 0);

export const NO_KATEGORI = "Tanpa Kategori";
export const OPEN_QUOT_STATUS = ["Draft", "Negosiasi"];
export const WON_STAGE = "Good Receive";

export const inMonths = (rows: FcRow[], months: string[]) => {
  const set = new Set(months);
  return rows.filter((r) => set.has(r.month));
};

export function salesTotals(rows: FcRow[]) {
  return { target: sum(rows, (r) => r.t_rp), actual: sum(rows, (r) => r.actual_rp) };
}

export const achievement = (actual: number, target: number) => (target ? (actual / target) * 100 : null);

// ---------------------------------------------------------------------------
// Quotation
// ---------------------------------------------------------------------------
export function quotationSummary(rows: QuotRow[]) {
  const out = { quotations: rows.length, items: 0, value: 0, win: 0, loss: 0, open: 0, cancel: 0, winCount: 0, lossCount: 0 };
  for (const q of rows) {
    for (const i of q.items) {
      out.items++;
      out.value += i.total;
      if (i.status === "Win") {
        out.win += i.total;
        out.winCount++;
      } else if (i.status === "Loss") {
        out.loss += i.total;
        out.lossCount++;
      } else if (i.status === "Cancel") out.cancel += i.total;
      else out.open += i.total;
    }
  }
  return { ...out, winRate: out.winCount + out.lossCount ? (out.winCount / (out.winCount + out.lossCount)) * 100 : null };
}

export function quotationByStatus(rows: QuotRow[]): StatusRow[] {
  return OPTIONS.quotationStatus.map((status) => {
    const items = rows.flatMap((q) => q.items.filter((i) => i.status === status));
    return { status, count: items.length, value: sum(items, (i) => i.total) };
  });
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------
/** Deal yang masuk Good Receive di rentang (satu kali per deal). */
export function wonDeals(ds: Dataset, range: DateRange) {
  const ids = new Set(ds.moves.filter((m) => m.to === WON_STAGE && inRange(m.date, range)).map((m) => m.deal));
  const deals = ds.deals.filter((d) => ids.has(d.id) && d.stage === WON_STAGE);
  return { deals, count: deals.length, value: sum(deals, (d) => d.value) };
}

export const openDeals = (deals: DealRow[]) => deals.filter((d) => d.stage !== WON_STAGE);

export function byStage(deals: DealRow[]): StageRow[] {
  return PIPELINE_STAGES.map((stage) => {
    const rows = deals.filter((d) => d.stage === stage);
    return { stage, count: rows.length, value: sum(rows, (d) => d.value) };
  });
}

export const reachedPo = (deals: DealRow[]) => deals.filter((d) => stageProgress(d.stage) >= stageProgress("PO"));

/** Rata-rata hari dari deal dibuat sampai pertama kali masuk Good Receive di rentang. */
export function cycleDays(ds: Dataset, range: DateRange) {
  const created = new Map(ds.deals.map((d) => [d.id, d.created]));
  const seen = new Set<string>();
  const days: number[] = [];
  for (const m of [...ds.moves].sort((a, b) => a.date.localeCompare(b.date))) {
    if (m.to !== WON_STAGE || !inRange(m.date, range) || seen.has(m.deal)) continue;
    const c = created.get(m.deal);
    if (!c) continue;
    seen.add(m.deal);
    days.push(Math.max(0, daysBetween(c, m.date)));
  }
  return days.length ? sum(days, (d) => d) / days.length : null;
}

// ---------------------------------------------------------------------------
// Kategori & bulan
// ---------------------------------------------------------------------------
export function byKategori(rows: FcRow[]): KategoriRow[] {
  const keys = [...OPTIONS.forecastKategori, NO_KATEGORI];
  return keys
    .map((k) => {
      const list = rows.filter((r) => (r.kategori ?? NO_KATEGORI) === k);
      return { kategori: k, target: sum(list, (r) => r.t_rp), actual: sum(list, (r) => r.actual_rp) };
    })
    .filter((r) => r.kategori !== NO_KATEGORI || r.target || r.actual);
}

export function byMonth(rows: FcRow[], months: string[], highlight: Set<string>): MonthRow[] {
  return months.map((m) => {
    const list = rows.filter((r) => r.month === m);
    return {
      month: m,
      label: fmtMonthShort(m),
      target: sum(list, (r) => r.t_rp),
      actual: sum(list, (r) => r.actual_rp),
      inRange: highlight.has(m),
    };
  });
}

// ---------------------------------------------------------------------------
// Tren per bucket waktu
// ---------------------------------------------------------------------------
export type TrendPoint<S extends string> = { date: string; hour: number; series: S; value?: number };

/** Jumlahkan titik (default bobot 1) per bucket waktu & seri; bucket kosong tetap ada (0). */
export function trend<S extends string>(
  range: DateRange,
  g: Granularity,
  series: readonly S[],
  points: TrendPoint<S>[],
): (TrendBucket & Record<S, number>)[] {
  const list = buckets(range, g);
  const index = new Map(list.map((b, i) => [b.key, i]));
  const out = list.map((b) => ({
    key: b.key,
    label: b.label,
    from: b.range.from,
    to: b.range.to,
    ...(Object.fromEntries(series.map((s) => [s, 0])) as Record<S, number>),
  }));
  for (const p of points) {
    if (!inRange(p.date, range)) continue;
    const i = index.get(bucketKey(p.date, g, p.hour));
    if (i != null) (out[i] as Record<S, number>)[p.series] += p.value ?? 1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Peringkat sales
// ---------------------------------------------------------------------------
export function salesRanking(ds: Dataset, people: Person[], range: DateRange, months: string[]): SalesRank[] {
  const fc = inMonths(ds.forecasts, months);
  const acts = ds.activities.filter((r) => inRange(r.date, range));
  const quots = ds.quotations.filter((r) => inRange(r.date, range));
  const won = wonDeals(ds, range).deals;
  const newDeals = ds.deals.filter((d) => inRange(d.created, range));
  const custs = ds.customers.filter((r) => inRange(r.date, range));
  const group = <T extends { sales: string | null }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) if (r.sales) m.set(r.sales, [...(m.get(r.sales) ?? []), r]);
    return (id: string) => m.get(id) ?? [];
  };
  const g = { fc: group(fc), acts: group(acts), quots: group(quots), won: group(won), deals: group(newDeals), custs: group(custs) };
  return people
    .map((p) => {
      const t = salesTotals(g.fc(p.id));
      const q = quotationSummary(g.quots(p.id));
      const w = g.won(p.id);
      const a = g.acts(p.id) as ActRow[];
      return {
        id: p.id,
        name: p.name || p.username,
        target: t.target,
        actual: t.actual,
        ach: achievement(t.actual, t.target),
        quotWin: q.win,
        winRate: q.winRate,
        won: w.length,
        wonValue: sum(w, (d) => d.value),
        newDeals: g.deals(p.id).length,
        activities: a.length,
        visits: a.filter((r) => r.status === "Completed" && VISIT_TYPES.includes(r.type)).length,
        customers: g.custs(p.id).length,
      };
    })
    .sort((a, b) => b.actual - a.actual || b.wonValue - a.wonValue || a.name.localeCompare(b.name));
}

/** Sapaan menurut jam WIB. */
export function greetingOf(hour: number) {
  if (hour < 4) return "Selamat malam";
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 19) return "Selamat sore";
  return "Selamat malam";
}
