"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { getAppContext } from "@/lib/auth";
import { dbError, fail, ok, type ActionResult } from "@/lib/action-result";
import {
  ENTITIES,
  MAX_IMPORT_ERRORS,
  MAX_IMPORT_ROWS,
  importLine,
  quotationFormSchema,
  type ImportResult,
} from "@/lib/entities";

async function guard() {
  const ctx = await getAppContext();
  // Guard menu (UI). Data tetap dijaga RLS di DB (RPC save_quotation = security invoker).
  return { ctx, denied: !ctx.menus.some((m) => m.id === ENTITIES.quotation.menuId) };
}

function firstIssue(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const i = error.issues[0];
  if (!i) return "Data tidak valid";
  // items.2.qty → "Barang #3 qty"
  const [head, idx, field] = i.path;
  const where = head === "items" && typeof idx === "number" ? `Barang #${idx + 1}${field ? ` ${String(field)}` : ""}` : i.path.join(".");
  return where ? `${where}: ${i.message}` : i.message;
}

/** Simpan header + seluruh barang dalam satu transaksi. */
export async function saveQuotation(id: string | null, raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const { ctx, denied } = await guard();
    if (denied) return fail("Akses menu ditolak");
    const parsed = quotationFormSchema.safeParse(raw);
    if (!parsed.success) return fail(firstIssue(parsed.error));
    const { items, ...header } = parsed.data;

    const { data, error } = await ctx.supabase.rpc("save_quotation", {
      p_id: id,
      p_header: header,
      p_items: items,
    });
    if (error) return fail(dbError(error));
    revalidatePath(ENTITIES.quotation.href);
    return ok({ id: data as string }, id ? "Quotation diperbarui" : "Quotation disimpan");
  } catch (e) {
    unstable_rethrow(e);
    return fail(e instanceof Error ? e.message : "Gagal menyimpan");
  }
}

/** Export lama memakai PO Status (Pending/Win/Loss/Cancel). */
const legacyStatus = (v: unknown) => {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s === "Pending" ? "Negosiasi" : s;
};

/**
 * Import Excel: satu baris per barang (format hasil Export Excel). Baris dengan
 * customer_code + quot_no yang sama digabung menjadi satu quotation. `dryRun` hanya memvalidasi.
 */
export async function importQuotation(
  rows: Record<string, unknown>[],
  opts: { dryRun?: boolean } = {},
): Promise<ActionResult<ImportResult>> {
  try {
    const { ctx, denied } = await guard();
    if (denied) return fail("Akses menu ditolak");
    if (!Array.isArray(rows) || rows.length === 0) return fail("File kosong");
    if (rows.length > MAX_IMPORT_ROWS) return fail(`Maksimal ${MAX_IMPORT_ROWS} baris per import`);

    const { supabase } = ctx;
    const { data: customers } = await supabase.from("customers").select("id, customer_code");
    const custByCode = new Map((customers ?? []).map((c) => [String(c.customer_code).trim(), c.id as string]));

    const groups = new Map<string, { line: number; rows: Record<string, unknown>[] }>();
    rows.forEach((r, i) => {
      const key = `${String(r.customer_code ?? "").trim()}|${String(r.quot_no ?? "").trim()}`;
      const g = groups.get(key) ?? { line: importLine(r, i), rows: [] };
      g.rows.push(r);
      groups.set(key, g);
    });

    let inserted = 0;
    const errors: string[] = [];
    for (const { line, rows: group } of groups.values()) {
      const first = group[0];
      const code = String(first.customer_code ?? "").trim();
      const label = `Baris ${line}${first.quot_no ? ` (${first.quot_no})` : ""}`;
      const customerId = code ? custByCode.get(code) : "";
      if (customerId === undefined) {
        errors.push(`${label}: customer_code "${code}" tidak ditemukan`);
        continue;
      }
      const parsed = quotationFormSchema.safeParse({
        customer_id: customerId,
        quot_no: first.quot_no ?? "",
        kode_accurate: first.kode_accurate ?? "",
        tgl_quot: first.tgl_quot ?? "",
        tgl_exp: first.tgl_exp ?? "",
        remarks: first.remarks ?? "",
        items: group
          .filter((r) => String(r.part ?? "").trim())
          .map((r) => ({
            part: r.part,
            qty: r.qty ?? "",
            harga: r.harga ?? "",
            margin_p: r.margin_p ?? "",
            status: legacyStatus(r.status) || legacyStatus(r.po_status) || "Draft",
          })),
      });
      if (!parsed.success) {
        errors.push(`${label}: ${firstIssue(parsed.error)}`);
        continue;
      }
      if (opts.dryRun) {
        inserted++;
        continue;
      }
      const { items, ...header } = parsed.data;
      const { error } = await supabase.rpc("save_quotation", { p_id: null, p_header: header, p_items: items });
      if (error) {
        errors.push(`${label}: ${dbError(error)}`);
        continue;
      }
      inserted++;
    }
    if (!opts.dryRun) revalidatePath(ENTITIES.quotation.href);
    return ok({ inserted, skipped: errors.length, errors: errors.slice(0, MAX_IMPORT_ERRORS) });
  } catch (e) {
    unstable_rethrow(e);
    return fail(e instanceof Error ? e.message : "Import gagal");
  }
}
