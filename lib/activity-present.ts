import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { entityLabel, fieldLabel, fieldOrder, fmtWIB, isMoneyField, type ActivityRow } from "@/lib/activity-meta";
import { ROLE_LABEL, type Role } from "@/lib/constants";
import { fmtDay, fmtNumber, fmtRupiah } from "@/lib/format";

type Data = Record<string, unknown>;

export type ChangeRow = {
  id: number;
  entity: string;
  op: "INSERT" | "UPDATE" | "DELETE";
  record_id: string | null;
  label: string | null;
  fields: string[];
  old_data: Data | null;
  new_data: Data | null;
};

export type PresentedField = { key: string; label: string; before: string | null; after: string | null };

export type PresentedChange = {
  id: number;
  entity: string;
  entityLabel: string;
  op: ChangeRow["op"];
  recordId: string | null;
  label: string | null;
  /** UPDATE: kolom yang berubah · INSERT/DELETE: kolom yang terisi */
  fields: PresentedField[];
  raw: { before: Data | null; after: Data | null };
};

export type ItemDiff = {
  position: number;
  state: "added" | "removed" | "changed" | "same";
  cells: { key: string; label: string; before: string | null; after: string | null }[];
};

export type ActivityDetail = {
  /** perubahan pada data utama aksi ini */
  main: PresentedChange[];
  /** barang quotation: sebelum vs sesudah per baris */
  items: ItemDiff[] | null;
  /** perubahan lain dalam aksi yang sama (data terkait, hasil import, …) */
  related: PresentedChange[];
  shown: number;
  total: number;
};

/** Kolom berisi id data lain → ditampilkan sebagai nama. */
const REF_KIND: Record<string, "profile" | "customer" | "tenant" | "forecast" | "quotation"> = {
  owner: "profile",
  sales_id: "profile",
  user_id: "profile",
  changed_by: "profile",
  peserta: "profile",
  customer_id: "customer",
  tenant_id: "tenant",
  forecast_ref: "forecast",
  quotation_id: "quotation",
};

/** Disembunyikan dari daftar kolom (tetap ada di data lengkap). */
const HIDDEN = new Set(["id", "tenant_id", "created_at", "updated_at", "last_seen_at"]);

const ITEM_KEYS = ["part", "qty", "harga", "margin_p", "total", "status"];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);
const isAttachment = (v: unknown): v is { name: string } =>
  !!v && typeof v === "object" && typeof (v as { name?: unknown }).name === "string" && "path" in v;

type Refs = Map<string, string>;

function refLabel(kind: string, r: Data) {
  if (kind === "profile") return `${r.name} (@${r.username})`;
  if (kind === "customer") return [r.customer_code, r.pt].filter(Boolean).join(" · ");
  if (kind === "tenant") return `${r.name} (${r.code})`;
  if (kind === "forecast") return [r.part_no, r.periode].filter(Boolean).join(" · ");
  return String(r.quot_no ?? r.id);
}

const SNAPSHOT_KIND: Record<string, string> = {
  profiles: "profile",
  customers: "customer",
  tenants: "tenant",
  sales_forecast: "forecast",
  quotation: "quotation",
};

/** id di semua snapshot → nama (data yang sudah terhapus dikenali dari snapshot-nya). */
async function resolveRefs(admin: SupabaseClient, changes: ChangeRow[]): Promise<Refs> {
  const want: Record<string, Set<string>> = { profile: new Set(), customer: new Set(), tenant: new Set(), forecast: new Set(), quotation: new Set() };
  const refs: Refs = new Map();
  for (const c of changes) {
    for (const d of [c.old_data, c.new_data]) {
      if (!d) continue;
      for (const [k, kind] of Object.entries(REF_KIND)) {
        const v = d[k];
        for (const id of Array.isArray(v) ? v : [v]) if (isUuid(id)) want[kind].add(id);
      }
      const snap = SNAPSHOT_KIND[c.entity];
      if (snap && isUuid(d.id)) refs.set(d.id, refLabel(snap, { ...c.old_data, ...c.new_data }));
    }
  }
  const TABLE = {
    profile: ["profiles", "id, name, username"],
    customer: ["customers", "id, customer_code, pt"],
    tenant: ["tenants", "id, name, code"],
    forecast: ["sales_forecast", "id, part_no, periode"],
    quotation: ["quotation", "id, quot_no"],
  } as const;
  await Promise.all(
    (Object.keys(TABLE) as (keyof typeof TABLE)[]).map(async (kind) => {
      const ids = [...want[kind]].filter((id) => !refs.has(id)).slice(0, 300);
      if (!ids.length) return;
      const [table, cols] = TABLE[kind];
      const { data } = await admin.from(table).select(cols).in("id", ids);
      for (const r of (data ?? []) as unknown as Data[]) refs.set(String(r.id), refLabel(kind, r));
    }),
  );
  return refs;
}

function fmtValue(entity: string, key: string, v: unknown, refs: Refs): string | null {
  if (v === null || v === undefined || v === "") return null;
  const ref = (id: string) => refs.get(id) ?? `${id.slice(0, 8)}… (tidak ditemukan)`;
  if (Array.isArray(v)) {
    if (!v.length) return null;
    if (v.every(isAttachment)) return v.map((a) => a.name).join(", ");
    if (REF_KIND[key] || v.every(isUuid)) return v.map((id) => (isUuid(id) ? ref(id) : String(id))).join(", ");
    return v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ");
  }
  if (typeof v === "boolean") return v ? "Ya" : "Tidak";
  if (typeof v === "object") return JSON.stringify(v);
  if (REF_KIND[key] && isUuid(v)) return ref(v);
  if (key === "role" && typeof v === "string") return ROLE_LABEL[v as Role] ?? v;
  // urutan barang disimpan mulai 0
  if (entity === "quotation_items" && key === "position") return String((Number(v) || 0) + 1);
  if (isMoneyField(entity, key)) return fmtRupiah(v);
  if (typeof v === "number") return fmtNumber(v);
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return fmtWIB(s);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return fmtDay(s);
  return s;
}

const byForm = (entity: string) => (a: string, b: string) => fieldOrder(entity, a) - fieldOrder(entity, b);

function present(c: ChangeRow, refs: Refs): PresentedChange {
  const after = c.new_data;
  // UPDATE menyimpan nilai lama kolom yang berubah saja → lengkapi dari data sesudah
  const before = c.op === "UPDATE" && after ? { ...after, ...c.old_data } : c.old_data;
  const keys =
    c.op === "UPDATE"
      ? [...c.fields]
      : Object.keys((c.op === "DELETE" ? before : after) ?? {}).filter((k) => !HIDDEN.has(k));
  const fields = keys.sort(byForm(c.entity)).flatMap((k) => {
    const b = c.op === "INSERT" ? null : fmtValue(c.entity, k, before?.[k], refs);
    const a = c.op === "DELETE" ? null : fmtValue(c.entity, k, after?.[k], refs);
    // INSERT/DELETE: kolom kosong tidak perlu ditampilkan
    if (c.op !== "UPDATE" && a === null && b === null) return [];
    return [{ key: k, label: fieldLabel(c.entity, k), before: b, after: a }];
  });
  return {
    id: c.id,
    entity: c.entity,
    entityLabel: entityLabel(c.entity),
    op: c.op,
    recordId: c.record_id,
    label: c.label,
    fields,
    raw: { before, after },
  };
}

/** Barang quotation sebelum vs sesudah, dicocokkan per nomor urut. */
function itemsDiff(changes: ChangeRow[], refs: Refs): ItemDiff[] {
  const before = new Map<number, Data>();
  const after = new Map<number, Data>();
  const pos = (d: Data) => Number(d.position) || 0;
  for (const c of changes) {
    if (c.op === "DELETE" && c.old_data) before.set(pos(c.old_data), c.old_data);
    if (c.op === "INSERT" && c.new_data) after.set(pos(c.new_data), c.new_data);
    if (c.op === "UPDATE" && c.new_data) {
      const old = { ...c.new_data, ...c.old_data };
      before.set(pos(old), old);
      after.set(pos(c.new_data), c.new_data);
    }
  }
  const positions = [...new Set([...before.keys(), ...after.keys()])].sort((a, b) => a - b);
  return positions.map((p) => {
    const b = before.get(p);
    const a = after.get(p);
    const cells = ITEM_KEYS.map((k) => ({
      key: k,
      label: fieldLabel("quotation_items", k),
      before: b ? fmtValue("quotation_items", k, b[k], refs) : null,
      after: a ? fmtValue("quotation_items", k, a[k], refs) : null,
    }));
    const state = !b ? "added" : !a ? "removed" : cells.some((c) => c.before !== c.after) ? "changed" : "same";
    return { position: p + 1, state, cells };
  });
}

export async function presentDetail(
  admin: SupabaseClient,
  log: ActivityRow,
  changes: ChangeRow[],
  total: number,
): Promise<ActivityDetail> {
  const refs = await resolveRefs(admin, changes);
  const isMain = (c: ChangeRow) => c.entity === log.entity && c.record_id === log.record_id && !!log.record_id;
  const itemChanges =
    log.entity === "quotation" && log.record_id
      ? changes.filter((c) => c.entity === "quotation_items" && (c.new_data ?? c.old_data)?.quotation_id === log.record_id)
      : [];
  const used = new Set(itemChanges.map((c) => c.id));
  return {
    main: changes.filter(isMain).map((c) => present(c, refs)),
    items: itemChanges.length ? itemsDiff(itemChanges, refs) : null,
    related: changes.filter((c) => !isMain(c) && !used.has(c.id)).map((c) => present(c, refs)),
    shown: changes.length,
    total,
  };
}
