/**
 * Preferensi tampilan per user (tabel user_preferences): widget Dashboard &
 * seksi Analytics yang tampil, urutannya, lebar, dan periode default.
 * Dipakai server (validasi + baca) dan client (panel "Atur Tampilan").
 */
import { z } from "zod";
import { ANALYTICS_PRESETS, DASHBOARD_PRESETS, type PresetId } from "@/lib/period";

export type WidgetSize = "half" | "full";

export type WidgetDef<Id extends string = string> = {
  id: Id;
  label: string;
  description: string;
  size: WidgetSize;
  /** false = lebar tetap (mis. deretan kartu statistik) */
  resizable?: boolean;
  /** hanya Master/Admin */
  manager?: boolean;
};

export type LayoutItem = { id: string; visible: boolean; size: WidgetSize };

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
export const DASHBOARD_WIDGETS = [
  { id: "hero", label: "Capaian Penjualan", description: "Actual vs target periode ini, sisa target & kebutuhan per hari", size: "full", resizable: false },
  { id: "stats", label: "Kartu Statistik", description: "Angka utama periode ini, klik untuk lihat datanya", size: "full", resizable: false },
  { id: "agenda", label: "Perlu Tindak Lanjut", description: "Quotation mau expired, aktivitas pending, deal mandek, jadwal refreshment", size: "half" },
  { id: "sales_trend", label: "Tren Penjualan", description: "Target vs Actual per bulan", size: "half" },
  { id: "activity_trend", label: "Volume Aktivitas", description: "Aktivitas sales & admin, quotation, deal baru", size: "half" },
  { id: "funnel", label: "Pipeline per Stage", description: "Posisi deal saat ini dari Market Map s/d Good Receive", size: "half" },
  { id: "quotation", label: "Status Quotation", description: "Barang quotation per status negosiasi", size: "half" },
  { id: "kategori", label: "Forecast per Kategori", description: "Target vs Actual per kategori part", size: "half" },
  { id: "leaderboard", label: "Peringkat Sales", description: "Sales dengan Actual tertinggi", size: "half", manager: true },
  { id: "recent", label: "Aktivitas Terbaru", description: "Kegiatan terakhir di periode ini", size: "half" },
  { id: "anniversary", label: "Ulang Tahun Customer", description: "Pengingat H-10 ulang tahun perusahaan customer", size: "full" },
] as const satisfies WidgetDef[];

export type DashboardWidgetId = (typeof DASHBOARD_WIDGETS)[number]["id"];

export const DASHBOARD_TILES = [
  { id: "pipeline", label: "Pipeline Aktif" },
  { id: "won", label: "Deal Good Receive" },
  { id: "quotation", label: "Nilai Quotation" },
  { id: "win_rate", label: "Win Rate Quotation" },
  { id: "activities", label: "Aktivitas Sales" },
  { id: "visits", label: "Visit Customer" },
  { id: "customers", label: "Customer Baru" },
  { id: "online", label: "Akun Online" },
] as const;

export type DashboardTileId = (typeof DASHBOARD_TILES)[number]["id"];

export type DashboardPrefs = {
  period: PresetId;
  widgets: LayoutItem[];
  tiles: { id: string; visible: boolean }[];
};

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------
export const ANALYTICS_SECTIONS = [
  { id: "summary", label: "Ringkasan", description: "Angka utama dibanding periode sebelumnya", size: "full", resizable: false },
  { id: "sales_trend", label: "Penjualan per Bulan", description: "Target vs Actual Sales Forecast", size: "full" },
  { id: "activity_trend", label: "Tren Aktivitas Sales", description: "Aktivitas per status dari waktu ke waktu", size: "half" },
  { id: "quotation_trend", label: "Tren Quotation", description: "Nilai barang quotation per status", size: "half" },
  { id: "top_sales", label: "Peringkat Sales", description: "Actual, ACH, win rate, deal & aktivitas per sales", size: "full", manager: true },
  { id: "top_customers", label: "Top Customer", description: "Customer dengan Actual penjualan tertinggi", size: "half" },
  { id: "top_parts", label: "Top Sparepart", description: "Part dengan Actual Qty tertinggi", size: "half" },
  { id: "kategori", label: "Kategori", description: "Forecast per kategori part & pipeline per kategori", size: "half" },
  { id: "conversion", label: "Konversi Pipeline", description: "Deal baru periode ini & lama siklus sampai Good Receive", size: "half" },
  { id: "activity_types", label: "Aktivitas per Tipe", description: "Visit, Call, Meeting, dll.", size: "half" },
] as const satisfies WidgetDef[];

export type AnalyticsSectionId = (typeof ANALYTICS_SECTIONS)[number]["id"];

export const TOP_N_OPTIONS = [5, 10, 20] as const;
export type TopN = (typeof TOP_N_OPTIONS)[number];

export type AnalyticsPrefs = {
  period: PresetId;
  sections: LayoutItem[];
  topN: TopN;
};

// ---------------------------------------------------------------------------
// Default & normalisasi
// ---------------------------------------------------------------------------
export const PREF_KEYS = ["dashboard", "analytics"] as const;
export type PrefKey = (typeof PREF_KEYS)[number];

const defaultLayout = (defs: readonly WidgetDef[]): LayoutItem[] =>
  defs.map((d) => ({ id: d.id, visible: true, size: d.size }));

export const DEFAULT_DASHBOARD_PREFS: DashboardPrefs = {
  period: "1m",
  widgets: defaultLayout(DASHBOARD_WIDGETS),
  tiles: DASHBOARD_TILES.map((t) => ({ id: t.id, visible: true })),
};

export const DEFAULT_ANALYTICS_PREFS: AnalyticsPrefs = {
  period: "3m",
  sections: defaultLayout(ANALYTICS_SECTIONS),
  topN: 10,
};

const layoutSchema = z
  .array(z.object({ id: z.string().max(40), visible: z.boolean(), size: z.enum(["half", "full"]).optional() }))
  .max(40);
const toggleSchema = z.array(z.object({ id: z.string().max(40), visible: z.boolean() })).max(40);

export const dashboardPrefsSchema = z.object({
  period: z.enum(DASHBOARD_PRESETS as [PresetId, ...PresetId[]]),
  widgets: layoutSchema,
  tiles: toggleSchema,
});

export const analyticsPrefsSchema = z.object({
  period: z.enum(ANALYTICS_PRESETS as [PresetId, ...PresetId[]]),
  sections: layoutSchema,
  topN: z.union(TOP_N_OPTIONS.map((n) => z.literal(n)) as [z.ZodLiteral<5>, z.ZodLiteral<10>, z.ZodLiteral<20>]),
});

/** Urutan tersimpan dipertahankan; id yang sudah tidak ada dibuang, widget baru ditambahkan di akhir. */
function mergeLayout(saved: unknown, defs: readonly WidgetDef[]): LayoutItem[] {
  const parsed = layoutSchema.safeParse(saved);
  const out: LayoutItem[] = [];
  for (const item of parsed.success ? parsed.data : []) {
    const def = defs.find((d) => d.id === item.id);
    if (!def || out.some((o) => o.id === item.id)) continue;
    out.push({ id: def.id, visible: item.visible, size: def.resizable === false ? def.size : (item.size ?? def.size) });
  }
  for (const def of defs) if (!out.some((o) => o.id === def.id)) out.push({ id: def.id, visible: true, size: def.size });
  return out;
}

function mergeToggles(saved: unknown, defs: readonly { id: string }[]) {
  const parsed = toggleSchema.safeParse(saved);
  const out: { id: string; visible: boolean }[] = [];
  for (const item of parsed.success ? parsed.data : []) {
    if (defs.some((d) => d.id === item.id) && !out.some((o) => o.id === item.id)) out.push(item);
  }
  for (const def of defs) if (!out.some((o) => o.id === def.id)) out.push({ id: def.id, visible: true });
  return out;
}

type Raw = Record<string, unknown> | null | undefined;

export function normalizeDashboardPrefs(raw: Raw): DashboardPrefs {
  const period = dashboardPrefsSchema.shape.period.safeParse(raw?.period);
  return {
    period: period.success ? period.data : DEFAULT_DASHBOARD_PREFS.period,
    widgets: mergeLayout(raw?.widgets, DASHBOARD_WIDGETS),
    tiles: mergeToggles(raw?.tiles, DASHBOARD_TILES),
  };
}

export function normalizeAnalyticsPrefs(raw: Raw): AnalyticsPrefs {
  const period = analyticsPrefsSchema.shape.period.safeParse(raw?.period);
  const topN = analyticsPrefsSchema.shape.topN.safeParse(raw?.topN);
  return {
    period: period.success ? period.data : DEFAULT_ANALYTICS_PREFS.period,
    sections: mergeLayout(raw?.sections, ANALYTICS_SECTIONS),
    topN: topN.success ? topN.data : DEFAULT_ANALYTICS_PREFS.topN,
  };
}
