/**
 * Definisi entitas CRUD — satu sumber untuk form, tabel, export/import dan
 * validasi Zod (dipakai di client DAN di server action).
 */
import { z } from "zod";
import { OPTIONS, PIPELINE_STAGES } from "@/lib/constants";
import { fmtNumber, fmtPercent, fmtRupiah, pct, toNumber } from "@/lib/format";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = { id: string; owner: string; created_at: string; [k: string]: any };

export type ProfileLite = { id: string; username: string; name: string; role: string | null };
export type CustomerLite = {
  id: string;
  customer_code: string;
  pt: string;
  pic: string | null;
  wa: string | null;
  site: string | null;
  sales_id: string | null;
};
export type ForecastLite = { id: string; part_no: string; sales_id: string | null; customer: { pt: string } | null };

export type Lookup = {
  profiles: Map<string, ProfileLite>;
};

export type FieldType =
  | "text" | "email" | "number" | "date" | "month" | "select" | "textarea"
  | "customer" | "forecast" | "user" | "file";

export type FieldDef = {
  name: string;
  label: string;
  type: FieldType;
  options?: readonly string[];
  required?: boolean;
  /** nilai awal saat "Tambah" */
  initial?: string | number | ((me: ProfileLite) => string | number);
  /** untuk type "file": kolom path & nama file di tabel */
  pathField?: string;
  nameField?: string;
  accept?: string;
  /** isi otomatis field ini dari customer terpilih */
  fromCustomer?: keyof CustomerLite;
  /** sembunyikan di form (mis. dihitung DB) */
  hidden?: boolean;
};

export type ColumnKind = "text" | "code" | "money" | "number" | "percent" | "badge" | "mono";

export type ColumnDef = {
  key: string;
  header: string;
  kind?: ColumnKind;
  get: (row: Row, lk: Lookup) => string | number | null | undefined;
};

export type EntityKey =
  | "customers" | "sales_daily" | "admin_daily" | "pipeline" | "sales_forecast" | "quotation"
  | "forecast_trend" | "actual_vs_forecast" | "documentation" | "refreshment" | "evaluation";

export type EntityDef = {
  key: EntityKey;
  table: EntityKey;
  title: string;
  menuId: string;
  href: string;
  /** select PostgREST (join customer/forecast — bukan copy manual seperti prototipe) */
  select: string;
  orderBy?: { column: string; ascending: boolean };
  fields: FieldDef[];
  columns: ColumnDef[];
  schema: z.ZodObject<z.ZodRawShape>;
  /** ringkasan nilai turunan di form (live) */
  preview?: (v: Record<string, unknown>) => { label: string; value: string }[];
};

// ---------------------------------------------------------------------------
// Zod helpers — input form selalu string, dikonversi di sini
// ---------------------------------------------------------------------------
const optText = (max = 500) =>
  z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((v) => (v === null || v === undefined ? null : String(v).trim() || null))
    .pipe(z.string().max(max).nullable());

const reqText = (label: string, max = 200) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .pipe(z.string().min(1, `${label} wajib diisi`).max(max));

const num = (opts: { min?: number; max?: number; int?: boolean } = {}) =>
  z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((v) => (v === "" || v === null || v === undefined ? 0 : Number(String(v).replace(/,/g, ""))))
    .pipe(
      (() => {
        let s = z.number({ error: "Harus angka" }).finite("Harus angka");
        if (opts.int) s = s.int("Harus bilangan bulat");
        if (opts.min !== undefined) s = s.min(opts.min, `Minimal ${opts.min}`);
        if (opts.max !== undefined) s = s.max(opts.max, `Maksimal ${opts.max}`);
        return s;
      })(),
    );

const oneOf = (opts: readonly string[], label: string) =>
  z.string().refine((v) => opts.includes(v), `${label} tidak valid`);

const reqId = (label: string) => z.guid(`${label} wajib dipilih`);
const optId = z
  .union([z.guid(), z.literal(""), z.null(), z.undefined()])
  .transform((v) => v || null);

const dateStr = (required: boolean) =>
  required
    ? z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid")
    : z
        .union([z.string(), z.null(), z.undefined()])
        .transform((v) => v || null)
        .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid").nullable());

const monthStr = z.string().regex(/^\d{4}-\d{2}$/, "Periode harus format YYYY-MM");

/** path file Storage — divalidasi lagi di server (harus diawali tenant_id/) */
const filePath = z.string().max(500).nullable().optional();

// ---------------------------------------------------------------------------
// Kolom helper
// ---------------------------------------------------------------------------
const custCode: ColumnDef = { key: "customer_code", header: "Code", kind: "code", get: (r) => r.customer?.customer_code };
const custPt: ColumnDef = { key: "pt", header: "PT", get: (r) => r.customer?.pt };
const ownerCol: ColumnDef = { key: "owner", header: "Owner", get: (r, lk) => lk.profiles.get(r.owner)?.username };
const salesCol = (key = "sales_id"): ColumnDef => ({
  key: "sales",
  header: "Sales",
  get: (r, lk) => (r[key] ? lk.profiles.get(r[key])?.username : null),
});
const col = (key: string, header: string, kind?: ColumnKind): ColumnDef => ({ key, header, kind, get: (r) => r[key] });

const customerField: FieldDef = { name: "customer_id", label: "Customer Code", type: "customer", required: true };
const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);

const CUSTOMER_JOIN = "customer:customers(customer_code, pt, pic, wa, site, sales_id)";

// ---------------------------------------------------------------------------
// Entitas
// ---------------------------------------------------------------------------
export const ENTITIES: Record<EntityKey, EntityDef> = {
  customers: {
    key: "customers",
    table: "customers",
    title: "Customer DB",
    menuId: "customer",
    href: "/customers",
    select: "*",
    orderBy: { column: "customer_code", ascending: true },
    fields: [
      { name: "pt", label: "PT", type: "text", required: true },
      { name: "pic", label: "PIC", type: "text" },
      { name: "wa", label: "WA", type: "text" },
      { name: "email", label: "Email", type: "email" },
      { name: "jabatan", label: "Jabatan", type: "text" },
      { name: "site", label: "Site", type: "text" },
      { name: "cuti", label: "Jadwal Cuti", type: "text" },
      { name: "ultah", label: "Ulang Tahun", type: "text" },
      { name: "tinggal", label: "Tempat Tinggal", type: "text" },
      { name: "note", label: "Note", type: "textarea" },
      { name: "sales_id", label: "Sales", type: "user", initial: (me) => me.id },
    ],
    columns: [
      col("customer_code", "Code", "code"),
      salesCol(),
      col("pt", "PT"),
      col("pic", "PIC"),
      col("wa", "WA"),
      col("email", "Email"),
      col("jabatan", "Jabatan"),
      col("site", "Site"),
      col("note", "Note"),
    ],
    schema: z.object({
      pt: reqText("PT"),
      pic: optText(),
      wa: optText(30),
      email: optText(200).pipe(z.email("Email tidak valid").nullable()),
      jabatan: optText(),
      site: optText(),
      cuti: optText(),
      ultah: optText(50),
      tinggal: optText(),
      note: optText(2000),
      sales_id: optId,
    }),
  },

  sales_daily: {
    key: "sales_daily",
    table: "sales_daily",
    title: "Sales Daily Activity",
    menuId: "sales_daily",
    href: "/sales-daily",
    select: `*, ${CUSTOMER_JOIN}`,
    fields: [
      customerField,
      { name: "type", label: "Type", type: "select", options: OPTIONS.salesDailyType, initial: "Visit" },
      { name: "status", label: "Status", type: "select", options: OPTIONS.salesDailyStatus, initial: "Completed" },
      { name: "note", label: "Note", type: "textarea" },
      { name: "absensi", label: "Absensi", type: "text" },
      { name: "attachment", label: "Foto/File", type: "file", pathField: "attachment_path", nameField: "attachment_name" },
    ],
    columns: [
      custCode,
      col("type", "Type"),
      custPt,
      { key: "pic", header: "PIC", get: (r) => r.customer?.pic },
      col("status", "Status", "badge"),
      col("note", "Note"),
      col("absensi", "Absensi"),
      ownerCol,
    ],
    schema: z.object({
      customer_id: reqId("Customer Code"),
      type: oneOf(OPTIONS.salesDailyType, "Type"),
      status: oneOf(OPTIONS.salesDailyStatus, "Status"),
      note: optText(2000),
      absensi: optText(50),
      attachment_path: filePath,
      attachment_name: filePath,
    }),
  },

  admin_daily: {
    key: "admin_daily",
    table: "admin_daily",
    title: "Admin Daily Activity",
    menuId: "admin_daily",
    href: "/admin-daily",
    select: `*, ${CUSTOMER_JOIN}`,
    fields: [
      customerField,
      { name: "type", label: "Type", type: "select", options: OPTIONS.adminDailyType, initial: "PO Input" },
      { name: "ref_no", label: "Ref No", type: "text" },
      { name: "dokumen", label: "Dokumen", type: "text" },
      { name: "status", label: "Status", type: "select", options: OPTIONS.adminDailyStatus, initial: "Draft" },
    ],
    columns: [custCode, col("type", "Type"), col("ref_no", "Ref"), custPt, col("dokumen", "Dok"), col("status", "Status", "badge"), ownerCol],
    schema: z.object({
      customer_id: reqId("Customer Code"),
      type: oneOf(OPTIONS.adminDailyType, "Type"),
      ref_no: optText(100),
      dokumen: optText(),
      status: oneOf(OPTIONS.adminDailyStatus, "Status"),
    }),
  },

  pipeline: {
    key: "pipeline",
    table: "pipeline",
    title: "Pipeline Engine",
    menuId: "pipeline",
    href: "/pipeline",
    select: `*, ${CUSTOMER_JOIN}`,
    fields: [
      customerField,
      { name: "sales_id", label: "Sales", type: "user", initial: (me) => me.id },
      { name: "stage", label: "Stage", type: "select", options: PIPELINE_STAGES, initial: "Market Map" },
      { name: "value", label: "Value (Rp)", type: "number", initial: 100000000 },
      { name: "product", label: "Product", type: "text" },
      { name: "prob", label: "Prob %", type: "number", initial: 10 },
    ],
    columns: [
      custCode,
      custPt,
      salesCol(),
      col("stage", "Stage", "badge"),
      col("value", "Value", "money"),
      col("product", "Product"),
      { key: "prob", header: "Prob", kind: "percent", get: (r) => toNumber(r.prob) },
    ],
    schema: z.object({
      customer_id: reqId("Customer Code"),
      sales_id: optId,
      stage: oneOf(PIPELINE_STAGES, "Stage"),
      value: num({ min: 0 }),
      product: optText(),
      prob: num({ min: 0, max: 100, int: true }),
    }),
  },

  sales_forecast: {
    key: "sales_forecast",
    table: "sales_forecast",
    title: "Sales Forecast",
    menuId: "forecast",
    href: "/forecast",
    select: `*, ${CUSTOMER_JOIN}`,
    fields: [
      customerField,
      { name: "sales_id", label: "Sales", type: "user", fromCustomer: "sales_id" },
      { name: "part_no", label: "Part No", type: "text", required: true },
      { name: "deskripsi", label: "Deskripsi", type: "text" },
      { name: "periode", label: "Periode", type: "month", initial: thisMonth },
      { name: "t_qty", label: "Target Qty", type: "number" },
      { name: "t_rp", label: "Target Rp", type: "number" },
      { name: "actual_qty", label: "Actual Qty", type: "number" },
      { name: "actual_rp", label: "Actual Rp", type: "number" },
      { name: "status", label: "Status", type: "select", options: OPTIONS.forecastStatus, initial: "On Track" },
      { name: "remarks", label: "Remarks", type: "text" },
    ],
    columns: [
      custCode,
      salesCol(),
      custPt,
      col("part_no", "Part No", "mono"),
      col("periode", "Periode"),
      col("t_qty", "T.Qty", "number"),
      col("t_rp", "T.Rp", "money"),
      col("actual_qty", "A.Qty", "number"),
      col("actual_rp", "A.Rp", "money"),
      { key: "ach_qty", header: "ACH Qty%", kind: "percent", get: (r) => pct(r.actual_qty, r.t_qty) },
      { key: "ach_rp", header: "ACH Rp%", kind: "percent", get: (r) => pct(r.actual_rp, r.t_rp) },
      { key: "site", header: "Site", get: (r) => r.customer?.site },
      col("status", "Status", "badge"),
    ],
    schema: z.object({
      customer_id: reqId("Customer Code"),
      sales_id: optId,
      part_no: reqText("Part No", 100),
      deskripsi: optText(),
      periode: monthStr,
      t_qty: num({ min: 0 }),
      t_rp: num({ min: 0 }),
      actual_qty: num({ min: 0 }),
      actual_rp: num({ min: 0 }),
      status: oneOf(OPTIONS.forecastStatus, "Status"),
      remarks: optText(),
    }),
    preview: (v) => [
      { label: "ACH Qty", value: fmtPercent(pct(v.actual_qty, v.t_qty)) },
      { label: "ACH Rp", value: fmtPercent(pct(v.actual_rp, v.t_rp)) },
    ],
  },

  quotation: {
    key: "quotation",
    table: "quotation",
    title: "Monitoring Quotation",
    menuId: "quotation",
    href: "/quotation",
    select: `*, ${CUSTOMER_JOIN}`,
    orderBy: { column: "tgl_quot", ascending: false },
    fields: [
      customerField,
      { name: "quot_no", label: "Quot No", type: "text", required: true, initial: () => `QT-${Date.now().toString().slice(-4)}` },
      { name: "tgl_quot", label: "Tgl Quot", type: "date", initial: today },
      { name: "tgl_exp", label: "Tgl Exp", type: "date" },
      { name: "part", label: "Part", type: "text" },
      { name: "harga", label: "Harga", type: "number" },
      { name: "qty", label: "Qty", type: "number", initial: 1 },
      { name: "margin_p", label: "Margin %", type: "number", initial: 15 },
      { name: "po_status", label: "PO Status", type: "select", options: OPTIONS.poStatus, initial: "Pending" },
      { name: "loss", label: "Loss (Rp)", type: "number" },
      { name: "remarks", label: "Remarks", type: "text" },
    ],
    columns: [
      custCode,
      col("quot_no", "Quot No", "mono"),
      custPt,
      col("tgl_quot", "Tgl"),
      col("tgl_exp", "Exp"),
      col("part", "Part"),
      col("harga", "Harga", "money"),
      col("qty", "Qty", "number"),
      col("total", "Total", "money"),
      { key: "margin_p", header: "Margin%", kind: "percent", get: (r) => toNumber(r.margin_p) },
      col("margin_rp", "Margin Rp", "money"),
      col("po_status", "PO", "badge"),
    ],
    schema: z.object({
      customer_id: reqId("Customer Code"),
      quot_no: reqText("Quot No", 100),
      tgl_quot: dateStr(false),
      tgl_exp: dateStr(false),
      part: optText(),
      harga: num({ min: 0 }),
      qty: num({ min: 0 }),
      margin_p: num({ min: -100, max: 100 }),
      po_status: oneOf(OPTIONS.poStatus, "PO Status"),
      loss: num({ min: 0 }),
      remarks: optText(),
    }),
    preview: (v) => {
      const total = toNumber(v.harga) * toNumber(v.qty);
      return [
        { label: "Total", value: fmtRupiah(total) },
        { label: "Margin Rp", value: fmtRupiah(Math.round((total * toNumber(v.margin_p)) / 100)) },
      ];
    },
  },

  forecast_trend: {
    key: "forecast_trend",
    table: "forecast_trend",
    title: "Forecast Trend Analysis",
    menuId: "trend",
    href: "/forecast-trend",
    select: "*, forecast:sales_forecast(part_no, sales_id, customer:customers(customer_code, pt))",
    fields: [
      { name: "forecast_ref", label: "Referensi Forecast", type: "forecast", required: true },
      { name: "smt1_qty", label: "SMT1 Qty", type: "number" },
      { name: "smt2_qty", label: "SMT2 Qty", type: "number" },
      { name: "actual_2025", label: "Actual 2025", type: "number" },
      { name: "forecast_2026", label: "Forecast 2026", type: "number" },
      { name: "alasan", label: "Alasan", type: "textarea" },
    ],
    columns: [
      { key: "customer_code", header: "Code", kind: "code", get: (r) => r.forecast?.customer?.customer_code },
      { key: "pt", header: "PT", get: (r) => r.forecast?.customer?.pt },
      { key: "sales", header: "Sales", get: (r, lk) => lk.profiles.get(r.forecast?.sales_id)?.username },
      { key: "part_no", header: "Part", kind: "mono", get: (r) => r.forecast?.part_no },
      col("smt1_qty", "SMT1", "number"),
      col("smt2_qty", "SMT2", "number"),
      col("actual_2025", "Actual25", "number"),
      col("forecast_2026", "Fc26", "number"),
      {
        key: "dev",
        header: "Dev%",
        kind: "percent",
        get: (r) => pct(toNumber(r.forecast_2026) - toNumber(r.actual_2025), r.actual_2025),
      },
      {
        key: "ach",
        header: "ACH%",
        kind: "percent",
        get: (r) => pct(toNumber(r.smt1_qty) + toNumber(r.smt2_qty), r.forecast_2026),
      },
      col("alasan", "Alasan"),
    ],
    schema: z.object({
      forecast_ref: reqId("Referensi Forecast"),
      smt1_qty: num({ min: 0 }),
      smt2_qty: num({ min: 0 }),
      actual_2025: num({ min: 0 }),
      forecast_2026: num({ min: 0 }),
      alasan: optText(2000),
    }),
    preview: (v) => [
      { label: "Deviasi", value: fmtPercent(pct(toNumber(v.forecast_2026) - toNumber(v.actual_2025), v.actual_2025)) },
      { label: "ACH", value: fmtPercent(pct(toNumber(v.smt1_qty) + toNumber(v.smt2_qty), v.forecast_2026)) },
    ],
  },

  actual_vs_forecast: {
    key: "actual_vs_forecast",
    table: "actual_vs_forecast",
    title: "Sales Actual vs Forecast",
    menuId: "actual",
    href: "/actual",
    select: `*, ${CUSTOMER_JOIN}`,
    fields: [
      customerField,
      { name: "part_no", label: "Part No", type: "text", required: true },
      { name: "target_qty", label: "Target Qty", type: "number" },
      { name: "actual_qty", label: "Actual Qty", type: "number" },
    ],
    columns: [
      custCode,
      custPt,
      col("part_no", "Part", "mono"),
      col("target_qty", "Target", "number"),
      col("actual_qty", "Actual", "number"),
      { key: "short_qty", header: "Short Qty", kind: "number", get: (r) => toNumber(r.target_qty) - toNumber(r.actual_qty) },
      {
        key: "short_pct",
        header: "Short%",
        kind: "percent",
        get: (r) => pct(toNumber(r.target_qty) - toNumber(r.actual_qty), r.target_qty),
      },
      {
        key: "status",
        header: "Status",
        kind: "badge",
        get: (r) => (toNumber(r.target_qty) - toNumber(r.actual_qty) <= 0 ? "Tercapai" : "Shortage"),
      },
    ],
    schema: z.object({
      customer_id: reqId("Customer Code"),
      part_no: reqText("Part No", 100),
      target_qty: num({ min: 0 }),
      actual_qty: num({ min: 0 }),
    }),
    preview: (v) => {
      const sh = toNumber(v.target_qty) - toNumber(v.actual_qty);
      return [
        { label: "Shortage", value: `${fmtNumber(sh)} (${fmtPercent(pct(sh, v.target_qty))})` },
        { label: "Status", value: sh <= 0 ? "Tercapai" : "Shortage" },
      ];
    },
  },

  documentation: {
    key: "documentation",
    table: "documentation",
    title: "Documentation",
    menuId: "doc",
    href: "/documentation",
    select: `*, ${CUSTOMER_JOIN}`,
    fields: [
      { name: "customer_id", label: "Customer Code", type: "customer" },
      { name: "nama", label: "Nama Dokumen", type: "text", required: true },
      { name: "file", label: "File", type: "file", pathField: "file_path", nameField: "file_name" },
    ],
    columns: [custCode, custPt, col("nama", "Nama"), col("file_name", "File"), ownerCol],
    schema: z.object({
      customer_id: optId,
      nama: reqText("Nama Dokumen"),
      file_path: filePath,
      file_name: filePath,
    }),
  },

  refreshment: {
    key: "refreshment",
    table: "refreshment",
    title: "Refreshment & Assessment",
    menuId: "refreshment",
    href: "/refreshment",
    select: "*",
    orderBy: { column: "tanggal", ascending: false },
    fields: [
      { name: "tanggal", label: "Tanggal", type: "date", initial: today },
      { name: "jenis", label: "Jenis", type: "select", options: OPTIONS.refreshmentJenis, initial: "Weekly Brainstorming" },
      { name: "topik", label: "Topik", type: "text", required: true },
      { name: "durasi", label: "Durasi (menit)", type: "number", initial: 30 },
      { name: "peserta", label: "Peserta", type: "text", initial: (me) => me.username },
      { name: "nilai", label: "Nilai", type: "text" },
      { name: "ringkasan", label: "Ringkasan", type: "textarea" },
      { name: "status", label: "Status", type: "select", options: OPTIONS.refreshmentStatus, initial: "Terjadwal" },
    ],
    columns: [
      col("tanggal", "Tanggal"),
      col("jenis", "Jenis"),
      col("topik", "Topik"),
      { key: "durasi", header: "Durasi", get: (r) => `${toNumber(r.durasi)} mnt` },
      col("peserta", "Peserta"),
      col("nilai", "Nilai"),
      col("status", "Status", "badge"),
    ],
    schema: z.object({
      tanggal: dateStr(true),
      jenis: oneOf(OPTIONS.refreshmentJenis, "Jenis"),
      topik: reqText("Topik"),
      durasi: num({ min: 0, int: true }),
      peserta: optText(),
      nilai: optText(50),
      ringkasan: optText(2000),
      status: oneOf(OPTIONS.refreshmentStatus, "Status"),
    }),
  },

  evaluation: {
    key: "evaluation",
    table: "evaluation",
    title: "Evaluasi Bulanan Sales",
    menuId: "evaluation",
    href: "/evaluation",
    select: "*",
    orderBy: { column: "periode", ascending: false },
    fields: [
      { name: "periode", label: "Periode", type: "month", initial: thisMonth },
      { name: "sales_id", label: "Sales", type: "user", initial: (me) => me.id },
      { name: "topik", label: "Topik/Isu", type: "text", required: true },
      { name: "deskripsi", label: "Deskripsi", type: "textarea" },
      { name: "skor", label: "Skor 1-100", type: "number", initial: 75 },
      { name: "foto", label: "Foto", type: "file", pathField: "foto_path", accept: "image/*" },
      { name: "tindak", label: "Tindak Lanjut", type: "text" },
      { name: "status", label: "Status", type: "select", options: OPTIONS.evaluationStatus, initial: "Open" },
    ],
    columns: [
      col("periode", "Periode"),
      salesCol(),
      col("topik", "Topik"),
      col("skor", "Skor", "number"),
      col("tindak", "Tindak Lanjut"),
      col("status", "Status", "badge"),
    ],
    schema: z.object({
      periode: monthStr,
      sales_id: optId,
      topik: reqText("Topik"),
      deskripsi: optText(2000),
      skor: num({ min: 0, max: 100, int: true }),
      foto_path: filePath,
      tindak: optText(),
      status: oneOf(OPTIONS.evaluationStatus, "Status"),
    }),
  },
};

/** Field yang menyimpan path Storage untuk satu entitas */
export function filePathFields(def: EntityDef): string[] {
  return def.fields.filter((f) => f.type === "file" && f.pathField).map((f) => f.pathField!);
}

/** Baris → objek datar untuk export Excel (header = nama field, bisa di-import ulang) */
export function toExportRow(def: EntityDef, row: Row, lk: Lookup): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of def.fields) {
    if (f.type === "file") {
      if (f.nameField) out[f.nameField] = row[f.nameField] ?? "";
      continue;
    }
    if (f.type === "customer") out.customer_code = row.customer?.customer_code ?? "";
    else if (f.type === "user") out.sales = row[f.name] ? lk.profiles.get(row[f.name])?.username ?? "" : "";
    else if (f.type === "forecast") out.forecast_ref = row[f.name];
    else out[f.name] = row[f.name] ?? "";
  }
  // nilai turunan ikut diexport (diabaikan saat import)
  for (const c of def.columns) if (!(c.key in out)) out[c.key] = c.get(row, lk) ?? "";
  return out;
}

/** Baris → nilai tampilan (untuk PDF/Word) */
export function toDisplayRow(def: EntityDef, row: Row, lk: Lookup): string[] {
  return def.columns.map((c) => formatCell(c, c.get(row, lk)));
}

export function formatCell(c: Pick<ColumnDef, "kind">, v: unknown): string {
  if (v === null || v === undefined || v === "") return "-";
  switch (c.kind) {
    case "money":
      return fmtRupiah(v);
    case "number":
      return fmtNumber(v);
    case "percent":
      return fmtPercent(toNumber(v));
    default:
      return String(v);
  }
}
