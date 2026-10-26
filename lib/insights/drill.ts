/**
 * Drill-down: tabel data di balik angka/grafik Dashboard & Analytics, dimuat
 * saat diklik (server action loadDrill) supaya halaman tetap ringan.
 */
import { z } from "zod";
import { OPTIONS, PIPELINE_STAGES } from "@/lib/constants";
import { isDate, MAX_RANGE_DAYS, daysBetween } from "@/lib/period";

export const DRILL_KINDS = [
  "forecast",
  "pipeline",
  "won",
  "deals_new",
  "quotation_items",
  "activities",
  "admin",
  "customers_new",
  "quot_expiring",
  "quot_expired",
  "act_pending",
  "admin_pending",
  "deal_stale",
  "forecast_risk",
  "refreshment_upcoming",
] as const;

export type DrillKind = (typeof DRILL_KINDS)[number];

/** Maks. baris yang dikirim; sisanya dibuka lewat modul. */
export const DRILL_MAX_ROWS = 2000;

/** Status quotation gabungan untuk filter: Draft + Negosiasi. */
export const QUOT_OPEN = "Open";

const NO_KATEGORI = "Tanpa Kategori";
const kategori = [...OPTIONS.forecastKategori, ...OPTIONS.pipelineKategori, NO_KATEGORI] as string[];
const statuses = [
  ...OPTIONS.forecastStatus,
  ...OPTIONS.quotationStatus,
  ...OPTIONS.salesDailyStatus,
  ...OPTIONS.adminDailyStatus,
  QUOT_OPEN,
] as string[];

export const drillRequestSchema = z
  .object({
    kind: z.enum(DRILL_KINDS),
    from: z.string().refine(isDate),
    to: z.string().refine(isDate),
    sales: z.uuid().nullish(),
    filter: z
      .object({
        kategori: z.string().refine((v) => kategori.includes(v)),
        status: z.string().refine((v) => statuses.includes(v)),
        stage: z.enum(PIPELINE_STAGES),
        type: z.string().refine((v) => (OPTIONS.salesDailyType as readonly string[]).includes(v)),
        customer: z.uuid(),
        part: z.string().max(100),
        /** Visit + Meeting (VISIT_TYPES) */
        visit: z.boolean(),
      })
      .partial()
      .optional(),
  })
  .refine((v) => v.from <= v.to && daysBetween(v.from, v.to) < MAX_RANGE_DAYS, "Rentang tidak valid");

export type DrillRequest = z.input<typeof drillRequestSchema>;
export type DrillFilter = NonNullable<DrillRequest["filter"]>;

export type DrillColumnKind = "text" | "mono" | "money" | "number" | "percent" | "date" | "datetime" | "badge" | "days";

export type DrillColumn = {
  key: string;
  header: string;
  kind?: DrillColumnKind;
  /** key baris kedua (mis. nama part di bawah Part No) */
  sub?: string;
};

export type DrillCell = string | number | null;
export type DrillRow = { id: string; href?: string; cells: Record<string, DrillCell> };

export type DrillResult = {
  columns: DrillColumn[];
  rows: DrillRow[];
  /** total sebelum dipotong DRILL_MAX_ROWS */
  total: number;
  /** jumlah kolom angka yang layak ditotal di footer */
  totals: string[];
};

/** Modul sumber per jenis drill (tautan "Buka di modul"). */
export const DRILL_MODULE: Record<DrillKind, { menu: string; href: string }> = {
  forecast: { menu: "forecast", href: "/forecast" },
  forecast_risk: { menu: "forecast", href: "/forecast" },
  pipeline: { menu: "pipeline", href: "/pipeline" },
  won: { menu: "pipeline", href: "/pipeline" },
  deals_new: { menu: "pipeline", href: "/pipeline" },
  deal_stale: { menu: "pipeline", href: "/pipeline" },
  quotation_items: { menu: "quotation", href: "/quotation" },
  quot_expiring: { menu: "quotation", href: "/quotation" },
  quot_expired: { menu: "quotation", href: "/quotation" },
  activities: { menu: "sales_daily", href: "/sales-daily" },
  act_pending: { menu: "sales_daily", href: "/sales-daily" },
  admin: { menu: "admin_daily", href: "/admin-daily" },
  admin_pending: { menu: "admin_daily", href: "/admin-daily" },
  customers_new: { menu: "customer", href: "/customers" },
  refreshment_upcoming: { menu: "refreshment", href: "/refreshment" },
};
