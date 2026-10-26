import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { OPTIONS } from "@/lib/constants";
import { VISIT_TYPES } from "@/lib/kpi";
import type { ResolvedMenu } from "@/lib/menus";
import { ANALYTICS_PRESETS, inRange, resolvePeriod, type DateRange, type PeriodInput } from "@/lib/period";
import { normalizeAnalyticsPrefs } from "@/lib/prefs";
import {
  NO_KATEGORI,
  byKategori,
  byMonth,
  byStage,
  cycleDays,
  inMonths,
  quotationSummary,
  reachedPo,
  salesRanking,
  salesTotals,
  sum,
  trend,
  wonDeals,
  OPEN_QUOT_STATUS,
} from "./compute";
import { forSales, loadDataset, loadPeople, loadPrefs, salesParam, type Dataset } from "./load";
import type { AnalyticsData } from "./types";

/** Batas baris peringkat yang dikirim ke client (pilihan Top N maks. 20). */
const TOP_LIMIT = 20;

type Ctx = {
  supabase: SupabaseClient;
  profile: { id: string; name: string; username: string; role: string };
  menus: ResolvedMenu[];
};

function metrics(ds: Dataset, range: DateRange, months: string[]) {
  const s = salesTotals(inMonths(ds.forecasts, months));
  const q = quotationSummary(ds.quotations.filter((r) => inRange(r.date, range)));
  const w = wonDeals(ds, range);
  const acts = ds.activities.filter((r) => inRange(r.date, range));
  return {
    actual: s.actual,
    target: s.target,
    quotation: q.value,
    winRate: q.winRate,
    won: w.value,
    wonCount: w.count,
    newDeals: ds.deals.filter((d) => inRange(d.created, range)).length,
    activities: acts.length,
    visits: acts.filter((r) => r.status === "Completed" && VISIT_TYPES.includes(r.type)).length,
    customers: ds.customers.filter((r) => inRange(r.date, range)).length,
  };
}

export async function loadAnalytics({ supabase, profile, menus }: Ctx, sp: PeriodInput & { sales?: unknown }) {
  const isManager = profile.role !== "sales";
  const [people, rawPrefs] = await Promise.all([loadPeople(supabase), loadPrefs(supabase, profile.id, "analytics")]);
  const prefs = normalizeAnalyticsPrefs(rawPrefs);
  const period = resolvePeriod(sp, prefs.period, ANALYTICS_PRESETS);
  const sales = salesParam(sp.sales, isManager, people.sales);
  const { range, prev } = period;

  const all = await loadDataset(
    supabase,
    { from: prev.from, to: range.to },
    { from: period.prevMonths[0], to: period.months[period.months.length - 1] },
  );
  const ds = forSales(all, sales);
  const cur = metrics(ds, range, period.months);
  const before = metrics(ds, prev, period.prevMonths);
  const cmp = <K extends keyof typeof cur>(k: K) => ({ cur: cur[k] as number, prev: before[k] as number });

  const fc = inMonths(ds.forecasts, period.months);
  const quots = ds.quotations.filter((q) => inRange(q.date, range));
  const acts = ds.activities.filter((r) => inRange(r.date, range));
  const newDeals = ds.deals.filter((d) => inRange(d.created, range));

  // --- top customer: Actual forecast + nilai Win quotation ---
  const customers = new Map<string, { id: string; code: string; name: string; target: number; actual: number; quotWin: number }>();
  const customerOf = (id: string, name: string, code = "") => {
    let c = customers.get(id);
    if (!c) customers.set(id, (c = { id, code, name, target: 0, actual: 0, quotWin: 0 }));
    if (!c.code && code) c.code = code;
    return c;
  };
  for (const r of fc) {
    const c = customerOf(r.customer_id, r.customer, r.customer_code);
    c.target += r.t_rp;
    c.actual += r.actual_rp;
  }
  for (const q of quots) customerOf(q.customer_id, q.customer).quotWin += sum(q.items.filter((i) => i.status === "Win"), (i) => i.total);

  // --- top part ---
  const parts = new Map<string, { part: string; name: string | null; qty: number; rp: number; target: number }>();
  for (const r of fc) {
    const key = r.part_no.trim().toUpperCase();
    let p = parts.get(key);
    if (!p) parts.set(key, (p = { part: r.part_no, name: r.deskripsi, qty: 0, rp: 0, target: 0 }));
    if (!p.name && r.deskripsi) p.name = r.deskripsi;
    p.qty += r.actual_qty;
    p.rp += r.actual_rp;
    p.target += r.t_rp;
  }

  // --- pipeline per kategori ---
  const won = wonDeals(ds, range).deals;
  const pipelineKategori = [...OPTIONS.pipelineKategori, NO_KATEGORI]
    .map((k) => {
      const match = (d: { kategori: string | null }) => (d.kategori ?? NO_KATEGORI) === k;
      const open = ds.deals.filter((d) => d.stage !== "Good Receive" && match(d));
      return { kategori: k, open: sum(open, (d) => d.value), openCount: open.length, won: sum(won.filter(match), (d) => d.value) };
    })
    .filter((r) => r.kategori !== NO_KATEGORI || r.openCount || r.won);

  const g = period.granularity;
  const data: AnalyticsData = {
    viewer: {
      id: profile.id,
      name: profile.name || profile.username,
      role: profile.role,
      isManager,
      menus: menus.map((m) => m.id),
    },
    filter: { period, sales, people: isManager ? people.sales : [] },
    prefs,
    summary: {
      actual: cmp("actual"),
      target: cmp("target"),
      quotation: cmp("quotation"),
      winRate: { cur: cur.winRate, prev: before.winRate },
      won: cmp("won"),
      wonCount: cmp("wonCount"),
      newDeals: cmp("newDeals"),
      activities: cmp("activities"),
      visits: cmp("visits"),
      customers: cmp("customers"),
    },
    salesTrend: byMonth(ds.forecasts, period.months, new Set(period.months)),
    activityTrend: {
      granularity: g,
      rows: trend(range, g, ["Completed", "In Progress", "Pending"] as const, [
        ...acts.map((r) => ({
          date: r.date,
          hour: r.hour,
          series: (OPTIONS.salesDailyStatus as readonly string[]).includes(r.status)
            ? (r.status as "Completed" | "In Progress" | "Pending")
            : ("Pending" as const),
        })),
      ]),
    },
    quotationTrend: {
      granularity: g,
      rows: trend(
        range,
        g,
        ["Win", "Open", "Loss", "Cancel"] as const,
        quots.flatMap((q) =>
          q.items.map((i) => ({
            date: q.date,
            hour: q.hour,
            series: OPEN_QUOT_STATUS.includes(i.status) ? ("Open" as const) : (i.status as "Win" | "Loss" | "Cancel"),
            value: i.total,
          })),
        ),
      ),
    },
    topSales: isManager ? salesRanking(all, people.sales, range, period.months) : [],
    topCustomers: [...customers.values()]
      .filter((c) => c.actual || c.quotWin)
      .sort((a, b) => b.actual - a.actual || b.quotWin - a.quotWin)
      .slice(0, TOP_LIMIT),
    topParts: [...parts.values()]
      .filter((p) => p.qty || p.rp)
      .sort((a, b) => b.qty - a.qty || b.rp - a.rp)
      .slice(0, TOP_LIMIT),
    kategori: byKategori(fc),
    pipelineKategori,
    conversion: {
      newDeals: newDeals.length,
      newValue: sum(newDeals, (d) => d.value),
      byStage: byStage(newDeals),
      reachedPo: reachedPo(newDeals).length,
      won: won.length,
      cycleDays: cycleDays(ds, range),
      avgWonValue: won.length ? sum(won, (d) => d.value) / won.length : null,
    },
    activityTypes: OPTIONS.salesDailyType
      .map((type) => {
        const rows = acts.filter((r) => r.type === type);
        return { type, count: rows.length, completed: rows.filter((r) => r.status === "Completed").length };
      })
      .sort((a, b) => b.count - a.count),
  };
  return data;
}
