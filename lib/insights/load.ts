import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { monthOf, rangeTs, wibDate, wibHour, type DateRange } from "@/lib/period";
import { toNumber } from "@/lib/format";
import type { PrefKey } from "@/lib/prefs";
import type { Person } from "./types";

/** Sama dengan max_rows PostgREST (supabase/config.toml). */
const PAGE_SIZE = 1000;
/** Halaman lanjutan diambil paralel per kelompok. */
const CONCURRENCY = 4;

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/**
 * Ambil semua baris per halaman. Halaman pertama sendiri (kebanyakan query muat
 * satu halaman); bila penuh, halaman berikutnya diambil paralel. Query wajib
 * diurutkan kolom unik (mis. id) supaya halaman tidak tumpang tindih.
 */
export async function fetchAll<T>(page: (from: number, to: number) => Page<T>, max = Infinity): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0, batch = 1; ; from += batch * PAGE_SIZE, batch = CONCURRENCY) {
    const results = await Promise.all(
      Array.from({ length: batch }, (_, i) => page(from + i * PAGE_SIZE, from + (i + 1) * PAGE_SIZE - 1)),
    );
    for (const r of results) {
      if (r.error) throw new Error(r.error.message);
      out.push(...(r.data ?? []));
    }
    if (out.length >= max || results.some((r) => (r.data ?? []).length < PAGE_SIZE)) return out;
  }
}

// ---------------------------------------------------------------------------
// Dataset ternormalisasi. `sales` = profil yang diatribusikan:
// kolom Sales bila ada, selain itu pembuat baris (sama seperti KPI).
// Quotation & Admin Daily ikut Sales di customer-nya.
// ---------------------------------------------------------------------------
export type FcRow = {
  id: string;
  sales: string | null;
  month: string;
  kategori: string | null;
  status: string;
  part_no: string;
  deskripsi: string | null;
  t_qty: number;
  t_rp: number;
  actual_qty: number;
  actual_rp: number;
  customer_id: string;
  customer: string;
  customer_code: string;
};
export type ActRow = { id: string; sales: string; date: string; hour: number; type: string; status: string };
export type AdminRow = { id: string; sales: string | null; owner: string; date: string; hour: number; type: string; status: string };
export type DealRow = {
  id: string;
  sales: string | null;
  stage: string;
  value: number;
  kategori: string | null;
  created: string;
  createdHour: number;
  updated: string;
  customer: string;
};
export type MoveRow = { deal: string; from: string | null; to: string; date: string };
export type QuotItem = { status: string; total: number; margin: number };
export type QuotRow = {
  id: string;
  sales: string | null;
  quot_no: string;
  date: string;
  hour: number;
  exp: string | null;
  customer_id: string;
  customer: string;
  items: QuotItem[];
};
export type CustRow = { id: string; sales: string | null; date: string; hour: number };

export type Dataset = {
  forecasts: FcRow[];
  activities: ActRow[];
  admin: AdminRow[];
  deals: DealRow[];
  moves: MoveRow[];
  quotations: QuotRow[];
  customers: CustRow[];
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const one = (v: any) => (Array.isArray(v) ? v[0] : v) ?? null;

/**
 * Baris semua modul untuk jendela `window` (biasanya periode pembanding s/d
 * periode terpilih) + bulan forecast `fcMonths`. Pipeline diambil seluruhnya
 * (posisi saat ini). RLS berlaku: Sales hanya melihat datanya sendiri.
 */
export async function loadDataset(
  supabase: SupabaseClient,
  window: DateRange,
  fcMonths: { from: string; to: string },
): Promise<Dataset> {
  const ts = rangeTs(window);
  const [fc, act, adm, deals, moves, quot, cust] = await Promise.all([
    fetchAll<any>((a, b) =>
      supabase
        .from("sales_forecast")
        .select(
          "id, sales_id, owner, periode, kategori, status, part_no, deskripsi, t_qty, t_rp, actual_qty, actual_rp, customer_id, customer:customers(customer_code, pt)",
        )
        .gte("periode", fcMonths.from)
        .lte("periode", fcMonths.to)
        .order("id")
        .range(a, b),
    ),
    fetchAll<any>((a, b) =>
      supabase
        .from("sales_daily")
        .select("id, owner, type, status, created_at")
        .gte("created_at", ts.gte)
        .lt("created_at", ts.lt)
        .order("id")
        .range(a, b),
    ),
    fetchAll<any>((a, b) =>
      supabase
        .from("admin_daily")
        .select("id, owner, type, status, tanggal, created_at, customer:customers(sales_id)")
        .gte("tanggal", window.from)
        .lte("tanggal", window.to)
        .order("id")
        .range(a, b),
    ),
    fetchAll<any>((a, b) =>
      supabase
        .from("pipeline")
        .select("id, sales_id, owner, stage, value, kategori, created_at, updated_at, customer:customers(pt)")
        .order("id")
        .range(a, b),
    ),
    fetchAll<any>((a, b) =>
      supabase
        .from("pipeline_history")
        .select("id, pipeline_id, from_stage, to_stage, changed_at")
        .gte("changed_at", ts.gte)
        .lt("changed_at", ts.lt)
        .order("id")
        .range(a, b),
    ),
    // tanpa Tgl Quot → pakai tanggal dibuat
    fetchAll<any>((a, b) =>
      supabase
        .from("quotation")
        .select(
          "id, owner, quot_no, tgl_quot, tgl_exp, created_at, customer_id, customer:customers(pt, sales_id), items:quotation_items(status, total, margin_rp)",
        )
        .or(
          `and(tgl_quot.gte.${window.from},tgl_quot.lte.${window.to}),and(tgl_quot.is.null,created_at.gte."${ts.gte}",created_at.lt."${ts.lt}")`,
        )
        .order("id")
        .range(a, b),
    ),
    fetchAll<any>((a, b) =>
      supabase
        .from("customers")
        .select("id, sales_id, created_at")
        .gte("created_at", ts.gte)
        .lt("created_at", ts.lt)
        .order("id")
        .range(a, b),
    ),
  ]);

  return {
    forecasts: fc.map((r) => {
      const c = one(r.customer);
      return {
        id: r.id,
        sales: r.sales_id ?? r.owner,
        month: r.periode,
        kategori: r.kategori,
        status: r.status,
        part_no: r.part_no,
        deskripsi: r.deskripsi,
        t_qty: toNumber(r.t_qty),
        t_rp: toNumber(r.t_rp),
        actual_qty: toNumber(r.actual_qty),
        actual_rp: toNumber(r.actual_rp),
        customer_id: r.customer_id,
        customer: c?.pt ?? "-",
        customer_code: c?.customer_code ?? "",
      };
    }),
    activities: act.map((r) => ({
      id: r.id,
      sales: r.owner,
      date: wibDate(r.created_at),
      hour: wibHour(r.created_at),
      type: r.type,
      status: r.status,
    })),
    admin: adm.map((r) => ({
      id: r.id,
      sales: one(r.customer)?.sales_id ?? null,
      owner: r.owner,
      date: String(r.tanggal),
      hour: wibHour(r.created_at),
      type: r.type,
      status: r.status,
    })),
    deals: deals.map((r) => ({
      id: r.id,
      sales: r.sales_id ?? r.owner,
      stage: r.stage,
      value: toNumber(r.value),
      kategori: r.kategori,
      created: wibDate(r.created_at),
      createdHour: wibHour(r.created_at),
      updated: wibDate(r.updated_at),
      customer: one(r.customer)?.pt ?? "-",
    })),
    moves: moves.map((r) => ({ deal: r.pipeline_id, from: r.from_stage, to: r.to_stage, date: wibDate(r.changed_at) })),
    quotations: quot.map((r) => {
      const c = one(r.customer);
      return {
        id: r.id,
        sales: c?.sales_id ?? r.owner,
        quot_no: r.quot_no,
        date: r.tgl_quot ? String(r.tgl_quot) : wibDate(r.created_at),
        hour: wibHour(r.created_at),
        exp: r.tgl_exp,
        customer_id: r.customer_id,
        customer: c?.pt ?? "-",
        items: (r.items ?? []).map((i: any) => ({
          status: i.status,
          total: toNumber(i.total),
          margin: toNumber(i.margin_rp),
        })),
      };
    }),
    customers: cust.map((r) => ({ id: r.id, sales: r.sales_id, date: wibDate(r.created_at), hour: wibHour(r.created_at) })),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Saring dataset ke satu sales. Pergerakan stage ikut deal-nya. */
export function forSales(ds: Dataset, salesId: string | null): Dataset {
  if (!salesId) return ds;
  const deals = ds.deals.filter((r) => r.sales === salesId);
  const ids = new Set(deals.map((d) => d.id));
  return {
    forecasts: ds.forecasts.filter((r) => r.sales === salesId),
    activities: ds.activities.filter((r) => r.sales === salesId),
    admin: ds.admin.filter((r) => r.sales === salesId),
    deals,
    moves: ds.moves.filter((m) => ids.has(m.deal)),
    quotations: ds.quotations.filter((r) => r.sales === salesId),
    customers: ds.customers.filter((r) => r.sales === salesId),
  };
}

// ---------------------------------------------------------------------------
// Konteks halaman
// ---------------------------------------------------------------------------
/** Akun Sales aktif (opsi filter Sales) + peta id → nama untuk semua profil. */
export async function loadPeople(supabase: SupabaseClient) {
  const { data } = await supabase.from("profiles").select("id, username, name, role, active").order("name");
  const rows = (data ?? []) as (Person & { role: string | null; active: boolean })[];
  return {
    sales: rows.filter((p) => p.role === "sales" && p.active).map(({ id, name, username }) => ({ id, name, username })),
    names: new Map(rows.map((p) => [p.id, p.name || p.username])),
  };
}

/** Preferensi tersimpan; null bila belum ada / tabel belum dimigrasi. */
export async function loadPrefs(supabase: SupabaseClient, userId: string, key: PrefKey) {
  const { data, error } = await supabase
    .from("user_preferences")
    .select("value")
    .eq("user_id", userId)
    .eq("key", key)
    .maybeSingle<{ value: Record<string, unknown> }>();
  return error ? null : (data?.value ?? null);
}

/** Filter Sales dari URL: hanya Master/Admin, dan harus akun Sales yang dikenal. */
export function salesParam(raw: unknown, isManager: boolean, people: Person[]) {
  return isManager && typeof raw === "string" && people.some((p) => p.id === raw) ? raw : null;
}

export const monthWindow = (from: string, to: string) => ({ from: monthOf(from), to: monthOf(to) });
