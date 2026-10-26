import { requireMenu } from "@/lib/auth";
import { isMonth, kpiCalculator, monthsEnding, shiftMonth, wibMonth, type KpiInput } from "@/lib/kpi";
import { toNumber } from "@/lib/format";
import { KpiView, type KpiPerson } from "./kpi-view";

/** Jumlah bulan di grafik tren (termasuk periode terpilih). */
const TREND_MONTHS = 6;
/** Sama dengan max_rows PostgREST (supabase/config.toml). */
const PAGE_SIZE = 1000;

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** Ambil semua baris per halaman — satu periode bisa lebih dari max_rows. */
async function fetchAll<T>(page: (from: number, to: number) => Page<T>) {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if ((data ?? []).length < PAGE_SIZE) return out;
  }
}

export default async function KpiPage({ searchParams }: PageProps<"/kpi">) {
  const { periode } = await searchParams;
  const { supabase, profile } = await requireMenu("kpi");
  const isManager = profile.role !== "sales";

  const month = isMonth(periode) ? periode : wibMonth(new Date());
  const months = monthsEnding(month, TREND_MONTHS);
  const inWindow = new Set(months);
  const start = months[0];
  const next = shiftMonth(month, 1);
  // batas jendela dalam WIB, dikirim sebagai UTC
  const fromTs = new Date(`${start}-01T00:00:00+07:00`).toISOString();
  const toTs = new Date(`${next}-01T00:00:00+07:00`).toISOString();

  // RLS berlaku: Sales hanya menghitung data miliknya / yang di-assign ke dia
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [people, forecasts, activities, deals, quotations, customers, evaluations, refreshments] = await Promise.all([
    isManager
      ? supabase
          .from("profiles")
          .select("id, username, name")
          .eq("role", "sales")
          .eq("active", true)
          .order("name")
          .then((r) => (r.data ?? []) as KpiPerson[])
      : Promise.resolve<KpiPerson[]>([{ id: profile.id, username: profile.username, name: profile.name }]),
    fetchAll<any>((a, b) =>
      supabase
        .from("sales_forecast")
        .select("id, sales_id, owner, periode, t_rp, actual_rp")
        .gte("periode", start)
        .lte("periode", month)
        .order("id")
        .range(a, b),
    ),
    fetchAll<any>((a, b) =>
      supabase
        .from("sales_daily")
        .select("id, owner, type, status, created_at")
        .gte("created_at", fromTs)
        .lt("created_at", toTs)
        .order("id")
        .range(a, b),
    ),
    fetchAll<any>((a, b) =>
      supabase
        .from("pipeline")
        .select("id, sales_id, owner, created_at")
        .gte("created_at", fromTs)
        .lt("created_at", toTs)
        .order("id")
        .range(a, b),
    ),
    // tanpa Tgl Quot → pakai tanggal dibuat; batas atas disaring di bawah
    fetchAll<any>((a, b) =>
      supabase
        .from("quotation")
        .select("id, owner, tgl_quot, created_at, customer:customers(sales_id), items:quotation_items(status)")
        .or(`tgl_quot.gte.${start}-01,tgl_quot.is.null`)
        .order("id")
        .range(a, b),
    ),
    fetchAll<any>((a, b) =>
      supabase
        .from("customers")
        .select("id, sales_id, created_at")
        .not("sales_id", "is", null)
        .gte("created_at", fromTs)
        .lt("created_at", toTs)
        .order("id")
        .range(a, b),
    ),
    fetchAll<any>((a, b) =>
      supabase
        .from("evaluation")
        .select("id, sales_id, periode, skor")
        .gte("periode", start)
        .lte("periode", month)
        .order("id")
        .range(a, b),
    ),
    fetchAll<any>((a, b) =>
      supabase
        .from("refreshment")
        .select("id, tanggal, status, peserta")
        .gte("tanggal", `${start}-01`)
        .lt("tanggal", `${next}-01`)
        .order("id")
        .range(a, b),
    ),
  ]);

  // Atribusi ke sales: kolom Sales bila ada, selain itu pembuat baris.
  // Quotation tidak punya kolom Sales → ikut Sales di customer-nya.
  const input: KpiInput = {
    forecasts: forecasts.map((r) => ({
      sales: r.sales_id ?? r.owner,
      month: r.periode,
      t_rp: toNumber(r.t_rp),
      actual_rp: toNumber(r.actual_rp),
    })),
    activities: activities.map((r) => ({ sales: r.owner, month: wibMonth(r.created_at), type: r.type, status: r.status })),
    deals: deals.map((r) => ({ sales: r.sales_id ?? r.owner, month: wibMonth(r.created_at) })),
    quotationItems: quotations.flatMap((q) => {
      const m = q.tgl_quot ? String(q.tgl_quot).slice(0, 7) : wibMonth(q.created_at);
      if (!inWindow.has(m)) return [];
      const sales = q.customer?.sales_id ?? q.owner;
      return (q.items ?? []).map((i: { status: string }) => ({ sales, month: m, status: i.status }));
    }),
    customers: customers.map((r) => ({ sales: r.sales_id, month: wibMonth(r.created_at) })),
    evaluations: evaluations.map((r) => ({ sales: r.sales_id, month: r.periode, skor: toNumber(r.skor) })),
    refreshments: refreshments.map((r) => ({
      month: String(r.tanggal).slice(0, 7),
      status: r.status,
      peserta: r.peserta ?? [],
    })),
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const calc = kpiCalculator(input);
  const cards = Object.fromEntries(people.map((p) => [p.id, months.map((m) => calc(p.id, m))]));

  // Ringkasan tim untuk stat card: jumlah mentah, bukan rata-rata persentase per sales
  const ids = new Set(people.map((p) => p.id));
  const fcMonth = input.forecasts.filter((r) => r.month === month && r.sales && ids.has(r.sales));
  const actMonth = input.activities.filter((r) => r.month === month && ids.has(r.sales) && r.status === "Completed");
  const summary = {
    salesTarget: fcMonth.reduce((a, r) => a + r.t_rp, 0),
    salesActual: fcMonth.reduce((a, r) => a + r.actual_rp, 0),
    activities: actMonth.length,
  };

  return <KpiView month={month} months={months} people={people} cards={cards} summary={summary} isManager={isManager} />;
}
