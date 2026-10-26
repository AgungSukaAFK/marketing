/** Bentuk data siap-render Dashboard & Analytics (dihitung di server, dikirim ke client). */
import type { AnniversaryItem } from "@/lib/anniversary";
import type { Granularity, Period } from "@/lib/period";
import type { AnalyticsPrefs, DashboardPrefs } from "@/lib/prefs";

export type Person = { id: string; name: string; username: string };

/** Nilai periode ini vs periode pembanding. */
export type Compare = { cur: number; prev: number };

export type Viewer = {
  id: string;
  name: string;
  role: string;
  isManager: boolean;
  /** menu yang boleh dibuka (tautan "Buka di modul") */
  menus: string[];
};

export type PageFilter = {
  period: Period;
  /** filter Sales aktif (Master/Admin) */
  sales: string | null;
  people: Person[];
};

export type StageRow = { stage: string; count: number; value: number };
export type StatusRow = { status: string; count: number; value: number };
export type KategoriRow = { kategori: string; target: number; actual: number };
export type MonthRow = { month: string; label: string; target: number; actual: number; inRange: boolean };

export type SalesRank = {
  id: string;
  name: string;
  target: number;
  actual: number;
  /** null bila tidak ada target */
  ach: number | null;
  quotWin: number;
  winRate: number | null;
  won: number;
  wonValue: number;
  newDeals: number;
  activities: number;
  visits: number;
  customers: number;
};

export type AgendaId =
  | "quot_expiring" | "quot_expired" | "act_pending" | "admin_pending" | "deal_stale" | "forecast_risk" | "refreshment_upcoming";

export type AgendaItem = { id: AgendaId; count: number; value?: number };

export type RecentItem = {
  id: string;
  kind: "activity" | "move" | "quotation" | "customer";
  at: string;
  title: string;
  subtitle: string;
  who: string | null;
  status?: string;
  href?: string;
};

export type TrendBucket = { key: string; label: string; from: string; to: string };

export type DashboardData = {
  viewer: Viewer;
  filter: PageFilter;
  prefs: DashboardPrefs;
  greeting: { hello: string; date: string };
  hero: {
    target: Compare;
    actual: Compare;
    /** sisa hari di bulan berjalan (hanya bila periode memuat hari ini) */
    daysLeft: number | null;
  };
  tiles: {
    pipeline: { value: number; count: number; newDeals: number };
    won: Compare & { count: number };
    quotation: Compare & { quotations: number; items: number };
    winRate: { cur: number | null; prev: number | null; winValue: number };
    activities: Compare & { completed: number };
    visits: Compare;
    customers: Compare;
  };
  agenda: AgendaItem[];
  salesTrend: { months: MonthRow[]; extended: boolean };
  activityTrend: {
    granularity: Granularity;
    rows: (TrendBucket & { sales: number; admin: number; quotation: number; deals: number })[];
  };
  funnel: StageRow[];
  quotation: StatusRow[];
  kategori: KategoriRow[];
  leaderboard: SalesRank[];
  recent: RecentItem[];
  anniversaries: (AnniversaryItem & { salesName: string | null })[];
};

export type AnalyticsData = {
  viewer: Viewer;
  filter: PageFilter;
  prefs: AnalyticsPrefs;
  summary: {
    actual: Compare;
    target: Compare;
    quotation: Compare;
    winRate: { cur: number | null; prev: number | null };
    won: Compare;
    wonCount: Compare;
    newDeals: Compare;
    activities: Compare;
    visits: Compare;
    customers: Compare;
  };
  salesTrend: MonthRow[];
  activityTrend: {
    granularity: Granularity;
    rows: (TrendBucket & { Completed: number; "In Progress": number; Pending: number })[];
  };
  quotationTrend: {
    granularity: Granularity;
    rows: (TrendBucket & { Win: number; Open: number; Loss: number; Cancel: number })[];
  };
  topSales: SalesRank[];
  topCustomers: { id: string; code: string; name: string; target: number; actual: number; quotWin: number }[];
  topParts: { part: string; name: string | null; qty: number; rp: number; target: number }[];
  kategori: KategoriRow[];
  pipelineKategori: { kategori: string; open: number; openCount: number; won: number }[];
  conversion: {
    newDeals: number;
    newValue: number;
    byStage: StageRow[];
    reachedPo: number;
    won: number;
    /** rata-rata hari dari deal dibuat sampai Good Receive (deal yang GR di periode ini) */
    cycleDays: number | null;
    avgWonValue: number | null;
  };
  activityTypes: { type: string; count: number; completed: number }[];
};
