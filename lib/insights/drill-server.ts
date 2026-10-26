import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { stageProgress } from "@/lib/constants";
import { pct, toNumber } from "@/lib/format";
import { VISIT_TYPES } from "@/lib/kpi";
import { addDays, daysBetween, monthOf, monthsBetween, rangeTs, todayWIB, wibDate } from "@/lib/period";
import {
  ACT_PENDING_STATUS,
  ADMIN_PENDING_STATUS,
  DEAL_STALE_DAYS,
  FORECAST_RISK_STATUS,
  QUOT_EXPIRED_LOOKBACK,
  QUOT_EXPIRING_DAYS,
  REFRESHMENT_DAYS,
} from "./agenda";
import { NO_KATEGORI, OPEN_QUOT_STATUS, WON_STAGE } from "./compute";
import { DRILL_MAX_ROWS, QUOT_OPEN, type DrillColumn, type DrillFilter, type DrillResult, type DrillRow } from "./drill";
import { fetchAll, loadPeople } from "./load";

type Req = { kind: string; from: string; to: string; sales?: string | null; filter?: DrillFilter };

/* eslint-disable @typescript-eslint/no-explicit-any */
const one = (v: any) => (Array.isArray(v) ? v[0] : v) ?? null;
/** Ambil sedikit lebih dari batas tampil supaya tahu ada sisa. */
const CAP = DRILL_MAX_ROWS + 1;

const col = (key: string, header: string, kind?: DrillColumn["kind"], sub?: string): DrillColumn => ({ key, header, kind, sub });

/** Filter Sales di DB untuk tabel dengan kolom sales_id (fallback ke pembuat baris). */
const salesOr = (s: string) => `sales_id.eq.${s},and(sales_id.is.null,owner.eq.${s})`;

export async function runDrill(supabase: SupabaseClient, req: Req): Promise<DrillResult> {
  const { kind, from, to, sales, filter = {} } = req;
  const today = todayWIB();
  const ts = rangeTs({ from, to });
  const people = await loadPeople(supabase);
  const name = (id: string | null | undefined) => (id ? (people.names.get(id) ?? "-") : "-");
  const done = (columns: DrillColumn[], rows: DrillRow[], totals: string[] = []): DrillResult => ({
    columns,
    rows: rows.slice(0, DRILL_MAX_ROWS),
    total: rows.length,
    totals,
  });

  switch (kind) {
    case "forecast":
    case "forecast_risk": {
      const risk = kind === "forecast_risk";
      const months = risk ? [monthOf(today)] : monthsBetween(from, to);
      const rows = await fetchAll<any>((a, b) => {
        let q = supabase
          .from("sales_forecast")
          .select("id, sales_id, owner, periode, kategori, status, part_no, deskripsi, t_rp, actual_rp, customer:customers(customer_code, pt)")
          .gte("periode", months[0])
          .lte("periode", months[months.length - 1]);
        if (risk) q = q.in("status", FORECAST_RISK_STATUS);
        if (filter.status) q = q.eq("status", filter.status);
        if (filter.kategori) q = filter.kategori === NO_KATEGORI ? q.is("kategori", null) : q.eq("kategori", filter.kategori);
        if (filter.customer) q = q.eq("customer_id", filter.customer);
        // tanpa wildcard = sama persis, tidak peka huruf besar/kecil
        if (filter.part) q = q.ilike("part_no", filter.part.trim().replace(/[\\%_]/g, (c) => `\\${c}`));
        if (sales) q = q.or(salesOr(sales));
        return q.order("actual_rp", { ascending: false }).order("id").range(a, b);
      }, CAP);
      const part = filter.part?.trim().toUpperCase();
      return done(
        [
          col("periode", "Periode", "text"),
          col("part_no", "Part No", "mono", "deskripsi"),
          col("customer", "Customer", "text", "customer_code"),
          col("kategori", "Kategori"),
          col("sales", "Sales"),
          col("t_rp", "Target Rp", "money"),
          col("actual_rp", "Actual Rp", "money"),
          col("ach", "ACH", "percent"),
          col("status", "Status", "badge"),
        ],
        rows
          .filter((r) => !part || String(r.part_no).trim().toUpperCase() === part)
          .map((r) => {
            const c = one(r.customer);
            return {
              id: r.id,
              cells: {
                periode: r.periode,
                part_no: r.part_no,
                deskripsi: r.deskripsi,
                customer: c?.pt ?? "-",
                customer_code: c?.customer_code ?? null,
                kategori: r.kategori ?? NO_KATEGORI,
                sales: name(r.sales_id ?? r.owner),
                t_rp: toNumber(r.t_rp),
                actual_rp: toNumber(r.actual_rp),
                ach: pct(r.actual_rp, r.t_rp),
                status: r.status,
              },
            };
          }),
        ["t_rp", "actual_rp"],
      );
    }

    case "pipeline":
    case "deals_new":
    case "deal_stale": {
      const rows = await fetchAll<any>((a, b) => {
        let q = supabase
          .from("pipeline")
          .select("id, sales_id, owner, stage, value, kategori, created_at, updated_at, customer:customers(customer_code, pt)");
        if (kind === "deals_new") q = q.gte("created_at", ts.gte).lt("created_at", ts.lt);
        if (kind === "deal_stale")
          q = q
            .neq("stage", WON_STAGE)
            .lt("updated_at", new Date(`${addDays(today, -DEAL_STALE_DAYS)}T00:00:00+07:00`).toISOString());
        if (kind === "pipeline" && !filter.stage) q = q.neq("stage", WON_STAGE);
        if (filter.stage) q = q.eq("stage", filter.stage);
        if (filter.kategori) q = filter.kategori === NO_KATEGORI ? q.is("kategori", null) : q.eq("kategori", filter.kategori);
        if (sales) q = q.or(salesOr(sales));
        return q.order("value", { ascending: false }).order("id").range(a, b);
      }, CAP);
      return done(
        [
          col("customer", "Customer", "text", "customer_code"),
          col("kategori", "Kategori"),
          col("stage", "Stage", "badge"),
          col("progress", "Progress", "percent"),
          col("value", "Value", "money"),
          col("sales", "Sales"),
          col("created", "Dibuat", "date"),
          col("idle", "Tidak diperbarui", "days"),
        ],
        rows.map((r) => {
          const c = one(r.customer);
          return {
            id: r.id,
            cells: {
              customer: c?.pt ?? "-",
              customer_code: c?.customer_code ?? null,
              kategori: r.kategori ?? NO_KATEGORI,
              stage: r.stage,
              progress: stageProgress(r.stage),
              value: toNumber(r.value),
              sales: name(r.sales_id ?? r.owner),
              created: wibDate(r.created_at),
              idle: daysBetween(wibDate(r.updated_at), today),
            },
          };
        }),
        ["value"],
      );
    }

    case "won": {
      const moves = await fetchAll<any>(
        (a, b) =>
          supabase
            .from("pipeline_history")
            .select("id, pipeline_id, changed_at, pipeline:pipeline(id, sales_id, owner, stage, value, kategori, created_at, customer:customers(customer_code, pt))")
            .eq("to_stage", WON_STAGE)
            .gte("changed_at", ts.gte)
            .lt("changed_at", ts.lt)
            .order("changed_at")
            .order("id")
            .range(a, b),
        CAP,
      );
      const seen = new Set<string>();
      const rows: DrillRow[] = [];
      for (const m of moves) {
        const p = one(m.pipeline);
        if (!p || p.stage !== WON_STAGE || seen.has(p.id)) continue;
        if (sales && (p.sales_id ?? p.owner) !== sales) continue;
        if (filter.kategori && (p.kategori ?? NO_KATEGORI) !== filter.kategori) continue;
        seen.add(p.id);
        const c = one(p.customer);
        const date = wibDate(m.changed_at);
        rows.push({
          id: p.id,
          cells: {
            customer: c?.pt ?? "-",
            customer_code: c?.customer_code ?? null,
            kategori: p.kategori ?? NO_KATEGORI,
            value: toNumber(p.value),
            sales: name(p.sales_id ?? p.owner),
            created: wibDate(p.created_at),
            date,
            cycle: Math.max(0, daysBetween(wibDate(p.created_at), date)),
          },
        });
      }
      return done(
        [
          col("customer", "Customer", "text", "customer_code"),
          col("kategori", "Kategori"),
          col("value", "Value", "money"),
          col("sales", "Sales"),
          col("created", "Dibuat", "date"),
          col("date", "Good Receive", "date"),
          col("cycle", "Siklus", "days"),
        ],
        rows.sort((a, b) => String(b.cells.date).localeCompare(String(a.cells.date))),
        ["value"],
      );
    }

    case "quotation_items":
    case "quot_expiring":
    case "quot_expired": {
      const expiry = kind !== "quotation_items";
      const quots = await fetchAll<any>((a, b) => {
        let q = supabase
          .from("quotation")
          .select(
            "id, owner, quot_no, tgl_quot, tgl_exp, created_at, customer:customers(customer_code, pt, sales_id), items:quotation_items(id, position, part, qty, harga, total, margin_rp, status)",
          );
        if (kind === "quot_expiring") q = q.gte("tgl_exp", today).lte("tgl_exp", addDays(today, QUOT_EXPIRING_DAYS));
        else if (kind === "quot_expired") q = q.gte("tgl_exp", addDays(today, -QUOT_EXPIRED_LOOKBACK)).lt("tgl_exp", today);
        else
          q = q.or(
            `and(tgl_quot.gte.${from},tgl_quot.lte.${to}),and(tgl_quot.is.null,created_at.gte."${ts.gte}",created_at.lt."${ts.lt}")`,
          );
        if (filter.customer) q = q.eq("customer_id", filter.customer);
        return q.order("id").range(a, b);
      });
      const status = expiry ? QUOT_OPEN : filter.status;
      const match = (s: string) => !status || (status === QUOT_OPEN ? OPEN_QUOT_STATUS.includes(s) : s === status);
      const rows: DrillRow[] = [];
      for (const q of quots) {
        const c = one(q.customer);
        if (sales && (c?.sales_id ?? q.owner) !== sales) continue;
        const items = [...(q.items ?? [])].sort((x: any, y: any) => x.position - y.position).filter((i: any) => match(i.status));
        if (expiry) {
          if (!items.length) continue;
          rows.push({
            id: q.id,
            href: `/quotation/${q.id}`,
            cells: {
              quot_no: q.quot_no,
              customer: c?.pt ?? "-",
              tgl_quot: q.tgl_quot,
              tgl_exp: q.tgl_exp,
              left: daysBetween(today, q.tgl_exp),
              items: items.length,
              open: items.reduce((s: number, i: any) => s + toNumber(i.total), 0),
              sales: name(c?.sales_id ?? q.owner),
            },
          });
          continue;
        }
        for (const i of items)
          rows.push({
            id: i.id,
            href: `/quotation/${q.id}`,
            cells: {
              quot_no: q.quot_no,
              customer: c?.pt ?? "-",
              tgl_quot: q.tgl_quot ?? wibDate(q.created_at),
              part: i.part,
              qty: toNumber(i.qty),
              harga: toNumber(i.harga),
              total: toNumber(i.total),
              margin: toNumber(i.margin_rp),
              status: i.status,
              sales: name(c?.sales_id ?? q.owner),
            },
          });
      }
      if (expiry)
        return done(
          [
            col("quot_no", "Quot No", "mono", "customer"),
            col("tgl_quot", "Tgl Quot", "date"),
            col("tgl_exp", "Tgl Exp", "date"),
            col("left", kind === "quot_expired" ? "Lewat" : "Sisa", "days"),
            col("items", "Barang terbuka", "number"),
            col("open", "Nilai terbuka", "money"),
            col("sales", "Sales"),
          ],
          rows.sort((a, b) => String(a.cells.tgl_exp).localeCompare(String(b.cells.tgl_exp))),
          ["open"],
        );
      return done(
        [
          col("quot_no", "Quot No", "mono", "customer"),
          col("tgl_quot", "Tgl Quot", "date"),
          col("part", "Barang"),
          col("qty", "Qty", "number"),
          col("harga", "Harga", "money"),
          col("total", "Total", "money"),
          col("margin", "Margin", "money"),
          col("status", "Status", "badge"),
          col("sales", "Sales"),
        ],
        rows.sort((a, b) => String(b.cells.tgl_quot).localeCompare(String(a.cells.tgl_quot))),
        ["qty", "total", "margin"],
      );
    }

    case "activities":
    case "act_pending": {
      const rows = await fetchAll<any>((a, b) => {
        let q = supabase.from("sales_daily").select("id, owner, type, status, note, created_at, customer:customers(customer_code, pt)");
        if (kind === "act_pending") q = q.in("status", ACT_PENDING_STATUS);
        else q = q.gte("created_at", ts.gte).lt("created_at", ts.lt);
        if (filter.type) q = q.eq("type", filter.type);
        if (filter.visit) q = q.in("type", VISIT_TYPES);
        if (filter.status) q = q.eq("status", filter.status);
        if (sales) q = q.eq("owner", sales);
        return q.order("created_at", { ascending: false }).order("id").range(a, b);
      }, CAP);
      return done(
        [
          col("at", "Waktu", "datetime"),
          col("customer", "Customer", "text", "customer_code"),
          col("type", "Type"),
          col("status", "Status", "badge"),
          col("note", "Note"),
          col("sales", "Sales"),
          ...(kind === "act_pending" ? [col("age", "Umur", "days")] : []),
        ],
        rows.map((r) => {
          const c = one(r.customer);
          return {
            id: r.id,
            cells: {
              at: r.created_at,
              customer: c?.pt ?? "-",
              customer_code: c?.customer_code ?? null,
              type: r.type,
              status: r.status,
              note: r.note,
              sales: name(r.owner),
              age: daysBetween(wibDate(r.created_at), today),
            },
          };
        }),
      );
    }

    case "admin":
    case "admin_pending": {
      const rows = await fetchAll<any>((a, b) => {
        let q = supabase
          .from("admin_daily")
          .select(`id, owner, type, ref_no, status, tanggal, customer:customers${sales ? "!inner" : ""}(customer_code, pt, sales_id)`);
        if (kind === "admin_pending") q = q.in("status", ADMIN_PENDING_STATUS);
        else q = q.gte("tanggal", from).lte("tanggal", to);
        if (filter.status) q = q.eq("status", filter.status);
        if (sales) q = q.eq("customer.sales_id", sales);
        return q.order("tanggal", { ascending: false }).order("id").range(a, b);
      }, CAP);
      return done(
        [
          col("tanggal", "Tanggal", "date"),
          col("customer", "Customer", "text", "customer_code"),
          col("type", "Type"),
          col("ref_no", "Ref", "mono"),
          col("status", "Status", "badge"),
          col("owner", "Admin"),
        ],
        rows.map((r) => {
          const c = one(r.customer);
          return {
            id: r.id,
            cells: {
              tanggal: r.tanggal,
              customer: c?.pt ?? "-",
              customer_code: c?.customer_code ?? null,
              type: r.type,
              ref_no: r.ref_no,
              status: r.status,
              owner: name(r.owner),
            },
          };
        }),
      );
    }

    case "customers_new": {
      const rows = await fetchAll<any>((a, b) => {
        let q = supabase
          .from("customers")
          .select("id, customer_code, pt, pic, site, sales_id, created_at")
          .gte("created_at", ts.gte)
          .lt("created_at", ts.lt);
        if (sales) q = q.eq("sales_id", sales);
        return q.order("created_at", { ascending: false }).order("id").range(a, b);
      }, CAP);
      return done(
        [
          col("customer_code", "Code", "mono"),
          col("pt", "PT"),
          col("pic", "PIC"),
          col("site", "Site"),
          col("sales", "Sales"),
          col("created", "Dibuat", "date"),
        ],
        rows.map((r) => ({
          id: r.id,
          cells: {
            customer_code: r.customer_code,
            pt: r.pt,
            pic: r.pic,
            site: r.site,
            sales: name(r.sales_id),
            created: wibDate(r.created_at),
          },
        })),
      );
    }

    case "refreshment_upcoming": {
      let q = supabase
        .from("refreshment")
        .select("id, tanggal, jenis, topik, durasi, peserta")
        .eq("status", "Terjadwal")
        .gte("tanggal", today)
        .lte("tanggal", addDays(today, REFRESHMENT_DAYS));
      if (sales) q = q.contains("peserta", [sales]);
      const { data } = await q.order("tanggal").limit(CAP);
      return done(
        [
          col("tanggal", "Tanggal", "date"),
          col("jenis", "Jenis"),
          col("topik", "Topik"),
          col("durasi", "Durasi (mnt)", "number"),
          col("peserta", "Peserta"),
        ],
        (data ?? []).map((r: any) => ({
          id: r.id,
          cells: {
            tanggal: r.tanggal,
            jenis: r.jenis,
            topik: r.topik,
            durasi: toNumber(r.durasi),
            peserta: (r.peserta ?? []).map(name).join(", ") || "-",
          },
        })),
      );
    }
  }
  throw new Error("Jenis data tidak dikenal");
}
/* eslint-enable @typescript-eslint/no-explicit-any */
