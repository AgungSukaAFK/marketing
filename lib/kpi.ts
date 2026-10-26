/**
 * Key Performance Indicators (KPI) Sales — DRAFT untuk demo.
 *
 * Belum ada KPI resmi dari user, jadi definisi, target, dan bobot di bawah
 * adalah usulan internal yang akan disesuaikan saat evaluasi. Semua angka
 * dihitung dari data modul yang sudah ada (tanpa tabel baru), per sales per
 * bulan (WIB). Ubah KPI_DEFS untuk menyesuaikan — halaman ikut menyesuaikan.
 */
import { pct } from "@/lib/format";

export type KpiGroup = "Hasil" | "Aktivitas" | "Pengembangan";
export const KPI_GROUPS: KpiGroup[] = ["Hasil", "Aktivitas", "Pengembangan"];

export type KpiId =
  | "sales_ach" | "quot_win" | "new_deal" | "activity" | "visit" | "new_customer" | "eval_score" | "refreshment";

export type KpiUnit = "percent" | "count" | "score";

export type KpiDef = {
  id: KpiId;
  label: string;
  group: KpiGroup;
  /** bobot (%) — total semua KPI = 100 */
  weight: number;
  /** target bulanan, dalam satuan `unit` */
  target: number;
  unit: KpiUnit;
  formula: string;
  /** menu sumber data */
  source: string;
};

export const KPI_DEFS: KpiDef[] = [
  {
    id: "sales_ach",
    label: "Pencapaian Penjualan",
    group: "Hasil",
    weight: 35,
    target: 100,
    unit: "percent",
    formula: "Actual Rp ÷ Target Rp di Sales Forecast periode ini",
    source: "Sales Forecast",
  },
  {
    id: "quot_win",
    label: "Win Rate Quotation",
    group: "Hasil",
    weight: 15,
    target: 50,
    unit: "percent",
    formula: "Barang Win ÷ (Win + Loss), quotation bertanggal periode ini",
    source: "Monitoring Quotation",
  },
  {
    id: "new_deal",
    label: "Deal Pipeline Baru",
    group: "Hasil",
    weight: 10,
    target: 4,
    unit: "count",
    formula: "Jumlah deal baru yang dibuat periode ini",
    source: "Pipeline Progress",
  },
  {
    id: "activity",
    label: "Aktivitas Selesai",
    group: "Aktivitas",
    weight: 15,
    target: 40,
    unit: "count",
    formula: "Sales Daily Activity berstatus Completed (±2 per hari kerja)",
    source: "Sales Daily Activity",
  },
  {
    id: "visit",
    label: "Kunjungan Customer",
    group: "Aktivitas",
    weight: 10,
    target: 12,
    unit: "count",
    formula: "Aktivitas Visit / Meeting berstatus Completed",
    source: "Sales Daily Activity",
  },
  {
    id: "new_customer",
    label: "Customer Baru",
    group: "Aktivitas",
    weight: 5,
    target: 2,
    unit: "count",
    formula: "Customer baru dengan Sales = ybs",
    source: "Customer DB",
  },
  {
    id: "eval_score",
    label: "Skor Evaluasi Bulanan",
    group: "Pengembangan",
    weight: 5,
    target: 80,
    unit: "score",
    formula: "Rata-rata skor Evaluasi Bulanan Sales periode ini",
    source: "Evaluasi Bulanan Sales",
  },
  {
    id: "refreshment",
    label: "Kehadiran Refreshment",
    group: "Pengembangan",
    weight: 5,
    target: 100,
    unit: "percent",
    formula: "Sesi Refreshment selesai yang diikuti ÷ semua sesi selesai",
    source: "Refreshment & Assessment",
  },
];

/** Capaian per KPI dibatasi 120% supaya satu KPI tidak menutupi KPI lain. */
export const KPI_CAP = 120;

/** Aktivitas yang dihitung sebagai kunjungan. */
export const VISIT_TYPES = ["Visit", "Meeting"];

/** Predikat skor total, dari yang tertinggi. `min` inklusif. */
export const KPI_GRADES = [
  { label: "Sangat Baik", min: 100 },
  { label: "Baik", min: 85 },
  { label: "Cukup", min: 70 },
  { label: "Perlu Perbaikan", min: 0 },
] as const;

export type KpiGradeLabel = (typeof KPI_GRADES)[number]["label"];

export const kpiGrade = (score: number): KpiGradeLabel =>
  (KPI_GRADES.find((g) => score >= g.min) ?? KPI_GRADES[KPI_GRADES.length - 1]).label;

// ---------------------------------------------------------------------------
// Input ternormalisasi — `sales` = id profil, `month` = "YYYY-MM" (WIB)
// ---------------------------------------------------------------------------
export type KpiInput = {
  forecasts: { sales: string | null; month: string; t_rp: number; actual_rp: number }[];
  activities: { sales: string; month: string; type: string; status: string }[];
  deals: { sales: string | null; month: string }[];
  quotationItems: { sales: string | null; month: string; status: string }[];
  customers: { sales: string | null; month: string }[];
  evaluations: { sales: string | null; month: string; skor: number }[];
  refreshments: { month: string; status: string; peserta: string[] }[];
};

export type KpiValue = {
  id: KpiId;
  /** realisasi dalam satuan KPI */
  actual: number;
  /** null = belum ada data di periode ini → bobotnya dialihkan ke KPI lain */
  achievement: number | null;
  /** min(capaian, KPI_CAP) */
  score: number | null;
  /** rincian realisasi, mis. "Rp 120Jt dari Rp 200Jt" */
  detail?: string;
};

export type KpiCard = {
  salesId: string;
  month: string;
  items: KpiValue[];
  /** skor total tertimbang (0–KPI_CAP) */
  total: number;
  groups: Record<KpiGroup, number | null>;
};

/** Rata-rata tertimbang skor KPI yang punya data; bobot KPI tanpa data dibagi rata ke sisanya. */
function weighted(items: KpiValue[], defs: KpiDef[]) {
  let sum = 0;
  let w = 0;
  for (const def of defs) {
    const s = items.find((i) => i.id === def.id)?.score;
    if (s == null) continue;
    sum += s * def.weight;
    w += def.weight;
  }
  return w ? sum / w : null;
}

const key = (sales: string | null, month: string) => `${sales ?? ""}|${month}`;

function bucket<T extends { sales: string | null; month: string }>(rows: T[]) {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r.sales, r.month);
    const list = map.get(k);
    if (list) list.push(r);
    else map.set(k, [r]);
  }
  return (sales: string, month: string) => map.get(key(sales, month)) ?? [];
}

const juta = (v: number) => `Rp ${(v / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}Jt`;

/** Siapkan penghitung KPI sekali, lalu panggil per sales per bulan. */
export function kpiCalculator(input: KpiInput) {
  const fc = bucket(input.forecasts);
  const act = bucket(input.activities);
  const deal = bucket(input.deals);
  const quot = bucket(input.quotationItems);
  const cust = bucket(input.customers);
  const ev = bucket(input.evaluations);

  return (salesId: string, month: string): KpiCard => {
    const measure = (id: KpiId): Omit<KpiValue, "id" | "score"> => {
      const def = KPI_DEFS.find((d) => d.id === id)!;
      const count = (n: number) => ({ actual: n, achievement: pct(n, def.target), detail: `${n} dari target ${def.target}` });
      switch (id) {
        case "sales_ach": {
          const rows = fc(salesId, month);
          const target = rows.reduce((a, r) => a + r.t_rp, 0);
          const actual = rows.reduce((a, r) => a + r.actual_rp, 0);
          if (!target) return { actual: 0, achievement: null, detail: "Belum ada target forecast" };
          const ach = pct(actual, target);
          return { actual: ach, achievement: pct(ach, def.target), detail: `${juta(actual)} dari ${juta(target)}` };
        }
        case "quot_win": {
          const rows = quot(salesId, month);
          const win = rows.filter((r) => r.status === "Win").length;
          const loss = rows.filter((r) => r.status === "Loss").length;
          if (!win && !loss) return { actual: 0, achievement: null, detail: "Belum ada barang Win/Loss" };
          const rate = pct(win, win + loss);
          return { actual: rate, achievement: pct(rate, def.target), detail: `${win} Win, ${loss} Loss` };
        }
        case "new_deal":
          return count(deal(salesId, month).length);
        case "activity":
          return count(act(salesId, month).filter((r) => r.status === "Completed").length);
        case "visit":
          return count(
            act(salesId, month).filter((r) => r.status === "Completed" && VISIT_TYPES.includes(r.type)).length,
          );
        case "new_customer":
          return count(cust(salesId, month).length);
        case "eval_score": {
          const rows = ev(salesId, month);
          if (!rows.length) return { actual: 0, achievement: null, detail: "Belum ada evaluasi" };
          const avg = rows.reduce((a, r) => a + r.skor, 0) / rows.length;
          return { actual: avg, achievement: pct(avg, def.target), detail: `${rows.length} topik evaluasi` };
        }
        case "refreshment": {
          const sessions = input.refreshments.filter((r) => r.month === month && r.status === "Selesai");
          if (!sessions.length) return { actual: 0, achievement: null, detail: "Belum ada sesi selesai" };
          const joined = sessions.filter((r) => r.peserta.includes(salesId)).length;
          const rate = pct(joined, sessions.length);
          return { actual: rate, achievement: pct(rate, def.target), detail: `${joined} dari ${sessions.length} sesi` };
        }
      }
    };

    const items: KpiValue[] = KPI_DEFS.map((def) => {
      const m = measure(def.id);
      return { id: def.id, ...m, score: m.achievement == null ? null : Math.min(m.achievement, KPI_CAP) };
    });
    const groups = Object.fromEntries(
      KPI_GROUPS.map((g) => [g, weighted(items, KPI_DEFS.filter((d) => d.group === g))]),
    ) as Record<KpiGroup, number | null>;
    return { salesId, month, items, total: weighted(items, KPI_DEFS) ?? 0, groups };
  };
}

// ---------------------------------------------------------------------------
// Periode
// ---------------------------------------------------------------------------
const WIB_MONTH = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" });

/** timestamptz → "YYYY-MM" menurut WIB */
export const wibMonth = (ts: string | Date) => WIB_MONTH.format(new Date(ts)).slice(0, 7);

/** "2026-10" + (-2) → "2026-08" */
export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** n bulan berurutan yang berakhir di `end`, dari yang terlama */
export const monthsEnding = (end: string, n: number) =>
  Array.from({ length: n }, (_, i) => shiftMonth(end, i - n + 1));

export const isMonth = (v: unknown): v is string => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
