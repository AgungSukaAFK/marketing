import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { upcomingAnniversaries } from "@/lib/anniversary";
import { VISIT_TYPES } from "@/lib/kpi";
import type { ResolvedMenu } from "@/lib/menus";
import {
  DASHBOARD_PRESETS,
  addDays,
  addMonths,
  daysBetween,
  fmtLongDate,
  inRange,
  lastDayOf,
  monthOf,
  rangeTs,
  resolvePeriod,
  wibDate,
  wibHour,
  type PeriodInput,
} from "@/lib/period";
import { normalizeDashboardPrefs } from "@/lib/prefs";
import { toNumber } from "@/lib/format";
import {
  ACT_PENDING_STATUS,
  ADMIN_PENDING_STATUS,
  DEAL_STALE_DAYS,
  FORECAST_RISK_STATUS,
  QUOT_EXPIRED_LOOKBACK,
  QUOT_EXPIRING_DAYS,
  REFRESHMENT_DAYS,
} from "./agenda";
import {
  OPEN_QUOT_STATUS,
  byKategori,
  byMonth,
  byStage,
  greetingOf,
  inMonths,
  openDeals,
  quotationByStatus,
  quotationSummary,
  salesRanking,
  salesTotals,
  sum,
  trend,
  wonDeals,
} from "./compute";
import { fetchAll, forSales, loadDataset, loadPeople, loadPrefs, salesParam } from "./load";
import type { AgendaItem, DashboardData, RecentItem } from "./types";

/** Tren penjualan minimal sekian bulan supaya ada konteks walau periode pendek. */
const TREND_MIN_MONTHS = 6;
const RECENT_LIMIT = 12;

type Ctx = {
  supabase: SupabaseClient;
  profile: { id: string; name: string; username: string; role: string };
  menus: ResolvedMenu[];
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const one = (v: any) => (Array.isArray(v) ? v[0] : v) ?? null;

export async function loadDashboard({ supabase, profile, menus }: Ctx, sp: PeriodInput & { sales?: unknown }) {
  const isManager = profile.role !== "sales";
  const [people, rawPrefs] = await Promise.all([loadPeople(supabase), loadPrefs(supabase, profile.id, "dashboard")]);
  const prefs = normalizeDashboardPrefs(rawPrefs);
  const period = resolvePeriod(sp, prefs.period, DASHBOARD_PRESETS);
  const sales = salesParam(sp.sales, isManager, people.sales);
  const { range, prev, today } = period;

  const endMonth = monthOf(range.to);
  const trendMonths =
    period.months.length >= 3
      ? period.months
      : Array.from({ length: TREND_MIN_MONTHS }, (_, i) => addMonths(endMonth, i - TREND_MIN_MONTHS + 1));
  const fcFrom = [period.prevMonths[0], trendMonths[0]].sort()[0];
  const ts = rangeTs(range);
  const mine = (id: string | null | undefined) => !sales || id === sales;

  const [all, agendaRows, recentRows, ultah] = await Promise.all([
    loadDataset(supabase, { from: prev.from, to: range.to }, { from: fcFrom, to: endMonth }),
    Promise.all([
      fetchAll<any>((a, b) =>
        supabase
          .from("quotation")
          .select("id, owner, tgl_exp, customer:customers(sales_id), items:quotation_items(status, total)")
          .gte("tgl_exp", addDays(today, -QUOT_EXPIRED_LOOKBACK))
          .lte("tgl_exp", addDays(today, QUOT_EXPIRING_DAYS))
          .order("id")
          .range(a, b),
      ),
      fetchAll<any>((a, b) =>
        supabase.from("sales_daily").select("id, owner").in("status", ACT_PENDING_STATUS).order("id").range(a, b),
      ),
      fetchAll<any>((a, b) =>
        supabase
          .from("admin_daily")
          .select("id, customer:customers(sales_id)")
          .in("status", ADMIN_PENDING_STATUS)
          .order("id")
          .range(a, b),
      ),
      fetchAll<any>((a, b) =>
        supabase
          .from("sales_forecast")
          .select("id, sales_id, owner")
          .eq("periode", monthOf(today))
          .in("status", FORECAST_RISK_STATUS)
          .order("id")
          .range(a, b),
      ),
      supabase
        .from("refreshment")
        .select("id, peserta")
        .eq("status", "Terjadwal")
        .gte("tanggal", today)
        .lte("tanggal", addDays(today, REFRESHMENT_DAYS))
        .then((r) => r.data ?? []),
    ]),
    Promise.all([
      supabase
        .from("sales_daily")
        .select("id, owner, type, status, created_at, customer:customers(pt)")
        .gte("created_at", ts.gte)
        .lt("created_at", ts.lt)
        .order("created_at", { ascending: false })
        .limit(30)
        .then((r) => r.data ?? []),
      supabase
        .from("pipeline_history")
        .select("id, from_stage, to_stage, changed_at, changed_by, pipeline:pipeline(sales_id, owner, customer:customers(pt))")
        .gte("changed_at", ts.gte)
        .lt("changed_at", ts.lt)
        .order("changed_at", { ascending: false })
        .limit(30)
        .then((r) => r.data ?? []),
      supabase
        .from("quotation")
        .select("id, quot_no, owner, created_at, customer:customers(pt, sales_id)")
        .gte("created_at", ts.gte)
        .lt("created_at", ts.lt)
        .order("created_at", { ascending: false })
        .limit(30)
        .then((r) => r.data ?? []),
      supabase
        .from("customers")
        .select("id, pt, customer_code, sales_id, owner, created_at")
        .gte("created_at", ts.gte)
        .lt("created_at", ts.lt)
        .order("created_at", { ascending: false })
        .limit(30)
        .then((r) => r.data ?? []),
    ]),
    supabase
      .from("customers")
      .select("id, customer_code, pt, sales_id, ultah")
      .not("ultah", "is", null)
      .then((r) => r.data ?? []),
  ]);

  const ds = forSales(all, sales);
  const name = (id: string | null | undefined) => (id ? (people.names.get(id) ?? null) : null);

  // --- ringkasan penjualan (Forecast per bulan) ---
  const cur = salesTotals(inMonths(ds.forecasts, period.months));
  const before = salesTotals(inMonths(ds.forecasts, period.prevMonths));

  // --- kartu ---
  const quotCur = quotationSummary(ds.quotations.filter((q) => inRange(q.date, range)));
  const quotPrev = quotationSummary(ds.quotations.filter((q) => inRange(q.date, prev)));
  const wonCur = wonDeals(ds, range);
  const wonPrev = wonDeals(ds, prev);
  const open = openDeals(ds.deals);
  const actCur = ds.activities.filter((r) => inRange(r.date, range));
  const isVisit = (r: { type: string; status: string }) => r.status === "Completed" && VISIT_TYPES.includes(r.type);

  // --- tindak lanjut (relatif hari ini) ---
  const [quotExp, actPending, adminPending, fcRisk, refreshments] = agendaRows;
  const openItems = (q: any) => (q.items ?? []).filter((i: any) => OPEN_QUOT_STATUS.includes(i.status));
  const quotOpen = quotExp.filter((q) => mine(one(q.customer)?.sales_id ?? q.owner) && openItems(q).length);
  const expiring = quotOpen.filter((q) => q.tgl_exp >= today);
  const expired = quotOpen.filter((q) => q.tgl_exp < today);
  const openValue = (rows: any[]) => sum(rows, (q) => sum(openItems(q), (i: any) => toNumber(i.total)));
  const staleBefore = addDays(today, -DEAL_STALE_DAYS);
  const stale = open.filter((d) => d.updated < staleBefore);
  const agenda: AgendaItem[] = [
    { id: "quot_expired", count: expired.length, value: openValue(expired) },
    { id: "quot_expiring", count: expiring.length, value: openValue(expiring) },
    { id: "forecast_risk", count: fcRisk.filter((r) => mine(r.sales_id ?? r.owner)).length },
    { id: "deal_stale", count: stale.length, value: sum(stale, (d) => d.value) },
    { id: "act_pending", count: actPending.filter((r) => mine(r.owner)).length },
    { id: "admin_pending", count: adminPending.filter((r) => mine(one(r.customer)?.sales_id)).length },
    {
      id: "refreshment_upcoming",
      count: refreshments.filter((r: any) => !sales || (r.peserta ?? []).includes(sales)).length,
    },
  ];

  // --- aktivitas terbaru ---
  const [recentAct, recentMoves, recentQuot, recentCust] = recentRows as any[][];
  const recent: RecentItem[] = [
    ...recentAct
      .filter((r) => mine(r.owner))
      .map((r) => ({
        id: `a-${r.id}`,
        kind: "activity" as const,
        at: r.created_at,
        title: `${r.type} · ${one(r.customer)?.pt ?? "-"}`,
        subtitle: "Sales Daily Activity",
        who: name(r.owner),
        status: r.status,
      })),
    ...recentMoves
      .filter((r) => {
        const p = one(r.pipeline);
        return mine(p?.sales_id ?? p?.owner);
      })
      .map((r) => {
        const p = one(r.pipeline);
        return {
          id: `m-${r.id}`,
          kind: "move" as const,
          at: r.changed_at,
          title: one(p?.customer)?.pt ?? "-",
          subtitle: r.from_stage ? `${r.from_stage} → ${r.to_stage}` : `Deal baru · ${r.to_stage}`,
          who: name(r.changed_by),
          status: r.to_stage,
        };
      }),
    ...recentQuot
      .filter((r) => mine(one(r.customer)?.sales_id ?? r.owner))
      .map((r) => ({
        id: `q-${r.id}`,
        kind: "quotation" as const,
        at: r.created_at,
        title: `${r.quot_no} · ${one(r.customer)?.pt ?? "-"}`,
        subtitle: "Quotation dibuat",
        who: name(r.owner),
        href: `/quotation/${r.id}`,
      })),
    ...recentCust
      .filter((r) => mine(r.sales_id))
      .map((r) => ({
        id: `c-${r.id}`,
        kind: "customer" as const,
        at: r.created_at,
        title: r.pt,
        subtitle: `Customer baru · ${r.customer_code}`,
        who: name(r.owner),
      })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, RECENT_LIMIT);

  const nowHour = wibHour(new Date());
  const data: DashboardData = {
    viewer: {
      id: profile.id,
      name: profile.name || profile.username,
      role: profile.role,
      isManager,
      menus: menus.map((m) => m.id),
    },
    filter: { period, sales, people: isManager ? people.sales : [] },
    prefs,
    greeting: { hello: greetingOf(nowHour), date: fmtLongDate(wibDate(new Date())) },
    hero: {
      target: { cur: cur.target, prev: before.target },
      actual: { cur: cur.actual, prev: before.actual },
      daysLeft: period.current ? daysBetween(today, lastDayOf(monthOf(today))) : null,
    },
    tiles: {
      pipeline: {
        value: sum(open, (d) => d.value),
        count: open.length,
        newDeals: ds.deals.filter((d) => inRange(d.created, range)).length,
      },
      won: { cur: wonCur.value, prev: wonPrev.value, count: wonCur.count },
      quotation: { cur: quotCur.value, prev: quotPrev.value, quotations: quotCur.quotations, items: quotCur.items },
      winRate: { cur: quotCur.winRate, prev: quotPrev.winRate, winValue: quotCur.win },
      activities: {
        cur: actCur.length,
        prev: ds.activities.filter((r) => inRange(r.date, prev)).length,
        completed: actCur.filter((r) => r.status === "Completed").length,
      },
      visits: {
        cur: actCur.filter(isVisit).length,
        prev: ds.activities.filter((r) => inRange(r.date, prev) && isVisit(r)).length,
      },
      customers: {
        cur: ds.customers.filter((r) => inRange(r.date, range)).length,
        prev: ds.customers.filter((r) => inRange(r.date, prev)).length,
      },
    },
    agenda,
    salesTrend: {
      months: byMonth(ds.forecasts, trendMonths, new Set(period.months)),
      extended: trendMonths.length > period.months.length,
    },
    activityTrend: {
      granularity: period.granularity,
      rows: trend(range, period.granularity, ["sales", "admin", "quotation", "deals"] as const, [
        ...ds.activities.map((r) => ({ date: r.date, hour: r.hour, series: "sales" as const })),
        ...ds.admin.map((r) => ({ date: r.date, hour: r.hour, series: "admin" as const })),
        ...ds.quotations.map((r) => ({ date: r.date, hour: r.hour, series: "quotation" as const })),
        ...ds.deals.map((r) => ({ date: r.created, hour: r.createdHour, series: "deals" as const })),
      ]),
    },
    funnel: byStage(ds.deals),
    quotation: quotationByStatus(ds.quotations.filter((q) => inRange(q.date, range))),
    kategori: byKategori(inMonths(ds.forecasts, period.months)),
    leaderboard: isManager ? salesRanking(all, people.sales, range, period.months) : [],
    recent,
    anniversaries: upcomingAnniversaries(ultah.filter((c) => mine(c.sales_id))).map((a) => ({
      ...a,
      salesName: name(a.sales_id),
    })),
  };
  return data;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
