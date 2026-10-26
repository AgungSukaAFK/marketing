/**
 * Definisi entitas CRUD — satu sumber untuk form, tabel, export/import dan
 * validasi Zod (dipakai di client DAN di server action).
 */
import { z } from "zod";
import { OPTIONS, PIPELINE_STAGES, stageProgress } from "@/lib/constants";
import { fmtDay, fmtNumber, fmtPercent, fmtRupiah, pct, toNumber } from "@/lib/format";

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
  | "customer" | "forecast" | "user" | "users" | "file" | "files";

/** Satu lampiran pada field "files" (disimpan sebagai array jsonb). */
export type Attachment = { path: string; name: string; size: number };

export const MAX_ATTACHMENT_MB = 100;
export const MAX_ATTACHMENTS = 20;

export type FieldDef = {
  name: string;
  label: string;
  type: FieldType;
  options?: readonly string[];
  required?: boolean;
  /** nilai awal saat "Tambah" */
  initial?: string | number | ((me: ProfileLite) => string | number);
  /** untuk type "file": kolom path & nama file di tabel. Type "files" menyimpan Attachment[] di kolom `name`. */
  pathField?: string;
  nameField?: string;
  accept?: string;
  /** isi otomatis field ini dari customer terpilih */
  fromCustomer?: keyof CustomerLite;
  /** sembunyikan di form (mis. dihitung DB) */
  hidden?: boolean;
  /** tampilan input angka: format Rupiah (Rp 1.500.000) */
  money?: boolean;
  /** tampilan input angka: satuan di kanan, mis. "%" */
  suffix?: string;
};

export type ColumnKind = "text" | "code" | "money" | "number" | "percent" | "badge" | "mono" | "date";

export type ColumnDef = {
  key: string;
  header: string;
  kind?: ColumnKind;
  get: (row: Row, lk: Lookup) => string | number | null | undefined;
  /** baris kedua di bawah nilai (mis. Part Description di bawah Part No); ikut dicari & diexport PDF/Word */
  sub?: (row: Row, lk: Lookup) => string | null | undefined;
};

export type EntityKey =
  | "customers" | "sales_daily" | "admin_daily" | "pipeline" | "sales_forecast" | "quotation"
  | "actual_vs_forecast" | "documentation" | "refreshment" | "evaluation";

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
  /** export Excel kustom (mis. satu baris per barang); default toExportRow */
  exportRows?: (row: Row, lk: Lookup) => Record<string, unknown>[];
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
/** Daftar user (type "users"): form mengirim id dipisah koma, DB menyimpan uuid[]. */
const idList = (max = 50) =>
  z
    .union([z.string(), z.array(z.string()), z.null(), z.undefined()])
    .transform((v) => [...new Set((Array.isArray(v) ? v : String(v ?? "").split(",")).map((s) => s.trim()).filter(Boolean))])
    .pipe(z.array(z.guid("User tidak valid")).max(max, `Maksimal ${max} user`));
const optId = z
  .union([z.guid(), z.literal(""), z.null(), z.undefined()])
  .transform((v) => v || null);

/** Terima "YYYY-MM-DD" atau "DD/MM/YYYY" (mis. dari import Excel) → "YYYY-MM-DD". */
const toIsoDate = (v: string) => {
  const t = v.trim();
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : t;
};
const isoDate = z.string().refine((v) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
}, "Tanggal tidak valid");

const dateStr = (required: boolean) =>
  required
    ? z.string().transform(toIsoDate).pipe(isoDate)
    : z
        .union([z.string(), z.null(), z.undefined()])
        .transform((v) => (v ? toIsoDate(v) || null : null))
        .pipe(isoDate.nullable());

const monthStr = z.string().regex(/^\d{4}-\d{2}$/, "Periode harus format YYYY-MM");

/** path file Storage — divalidasi lagi di server (harus diawali tenant_id/) */
const filePath = z.string().max(500).nullable().optional();

const attachmentList = z
  .array(
    z.object({
      path: z.string().min(1).max(500),
      name: z.string().min(1).max(255),
      size: z.number().int().min(0).max(MAX_ATTACHMENT_MB * 1024 * 1024, `Maksimal ${MAX_ATTACHMENT_MB} MB per file`),
    }),
  )
  .max(MAX_ATTACHMENTS, `Maksimal ${MAX_ATTACHMENTS} lampiran`)
  .default([]);

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
/** uuid[] → "budi.santoso, rina" */
const usernames = (ids: unknown, lk: Lookup) =>
  (Array.isArray(ids) ? ids : [])
    .map((id) => lk.profiles.get(id)?.username)
    .filter(Boolean)
    .join(", ");
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
      { name: "cuti", label: "Lokasi Cuti", type: "text" },
      { name: "ultah", label: "Ulang Tahun Perusahaan", type: "date" },
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
      col("ultah", "Ultah", "date"),
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
      ultah: dateStr(false),
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
    orderBy: { column: "tanggal", ascending: false },
    fields: [
      { name: "tanggal", label: "Tanggal", type: "date", initial: today },
      customerField,
      { name: "type", label: "Type", type: "select", options: OPTIONS.adminDailyType, initial: "PO Input" },
      { name: "ref_no", label: "Ref No", type: "text" },
      { name: "dokumen", label: "Dokumen", type: "text" },
      { name: "status", label: "Status", type: "select", options: OPTIONS.adminDailyStatus, initial: "Draft" },
      { name: "attachments", label: "Attach Dokumen", type: "files" },
    ],
    columns: [
      col("tanggal", "Tanggal", "date"),
      custCode,
      col("type", "Type"),
      col("ref_no", "Ref"),
      custPt,
      col("dokumen", "Dok"),
      { key: "attachments", header: "Lampiran", get: (r) => (r.attachments?.length ? `${r.attachments.length} file` : null) },
      col("status", "Status", "badge"),
      ownerCol,
    ],
    schema: z.object({
      tanggal: dateStr(true),
      customer_id: reqId("Customer Code"),
      type: oneOf(OPTIONS.adminDailyType, "Type"),
      ref_no: optText(100),
      dokumen: optText(),
      status: oneOf(OPTIONS.adminDailyStatus, "Status"),
      attachments: attachmentList,
    }),
  },

  pipeline: {
    key: "pipeline",
    table: "pipeline",
    title: "Pipeline Progress",
    menuId: "pipeline",
    href: "/pipeline",
    select: `*, ${CUSTOMER_JOIN}, history:pipeline_history(id, from_stage, to_stage, changed_by, changed_at)`,
    fields: [
      customerField,
      { name: "sales_id", label: "Sales", type: "user", initial: (me) => me.id },
      { name: "stage", label: "Stage", type: "select", options: PIPELINE_STAGES, initial: "Market Map" },
      { name: "value", label: "Value", type: "number", initial: 100000000, money: true },
      { name: "kategori", label: "Kategori", type: "select", options: OPTIONS.pipelineKategori, required: true },
    ],
    columns: [
      custCode,
      custPt,
      salesCol(),
      col("stage", "Stage", "badge"),
      col("value", "Value", "money"),
      col("kategori", "Kategori"),
      { key: "progress", header: "Progress", kind: "percent", get: (r) => stageProgress(r.stage) },
    ],
    schema: z.object({
      customer_id: reqId("Customer Code"),
      sales_id: optId,
      stage: oneOf(PIPELINE_STAGES, "Stage"),
      value: num({ min: 0 }),
      kategori: oneOf(OPTIONS.pipelineKategori, "Kategori"),
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
      { name: "deskripsi", label: "Part Description", type: "text" },
      { name: "kategori", label: "Kategori", type: "select", options: OPTIONS.forecastKategori, required: true },
      { name: "periode", label: "Periode", type: "month", initial: thisMonth },
      { name: "t_qty", label: "Target Qty", type: "number" },
      { name: "t_rp", label: "Target Rp", type: "number", money: true },
      { name: "actual_qty", label: "Actual Qty", type: "number" },
      { name: "actual_rp", label: "Actual Rp", type: "number", money: true },
      { name: "status", label: "Status", type: "select", options: OPTIONS.forecastStatus, initial: "On Track" },
      { name: "remarks", label: "Remarks", type: "text" },
    ],
    columns: [
      custCode,
      salesCol(),
      custPt,
      { ...col("part_no", "Part", "mono"), sub: (r) => r.deskripsi },
      col("kategori", "Kategori"),
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
      kategori: oneOf(OPTIONS.forecastKategori, "Kategori"),
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

  // Header saja — barang (quotation_items) diisi di halaman /quotation/new & /quotation/[id]/edit,
  // divalidasi quotationFormSchema dan disimpan atomik lewat RPC save_quotation.
  quotation: {
    key: "quotation",
    table: "quotation",
    title: "Monitoring Quotation",
    menuId: "quotation",
    href: "/quotation",
    select: `*, ${CUSTOMER_JOIN}, items:quotation_items(id, position, part, harga, qty, margin_p, total, margin_rp, status)`,
    orderBy: { column: "tgl_quot", ascending: false },
    fields: [
      customerField,
      { name: "quot_no", label: "Quot No", type: "text", required: true, initial: () => `QT-${Date.now().toString().slice(-4)}` },
      { name: "kode_accurate", label: "Kode Accurate", type: "text" },
      { name: "tgl_quot", label: "Tgl Quot", type: "date", initial: today },
      { name: "tgl_exp", label: "Tgl Exp", type: "date" },
      { name: "remarks", label: "Remarks", type: "textarea" },
    ],
    columns: [
      custCode,
      col("quot_no", "Quot No", "mono"),
      col("kode_accurate", "Kode Accurate", "mono"),
      custPt,
      col("tgl_quot", "Tgl", "date"),
      col("tgl_exp", "Exp", "date"),
      { key: "items", header: "Barang", get: (r) => quotationItems(r).map((i) => i.part).join(", ") || null },
      { key: "total", header: "Total", kind: "money", get: (r) => quotationTotals(quotationItems(r)).total },
      { key: "margin_rp", header: "Margin Rp", kind: "money", get: (r) => quotationTotals(quotationItems(r)).margin },
      { key: "loss", header: "Loss", kind: "money", get: (r) => quotationTotals(quotationItems(r)).loss },
      { key: "status", header: "Status", get: (r) => statusSummary(quotationItems(r)) || null },
    ],
    schema: z.object({
      customer_id: reqId("Customer Code"),
      quot_no: reqText("Quot No", 100),
      kode_accurate: optText(100),
      tgl_quot: dateStr(false),
      tgl_exp: dateStr(false),
      remarks: optText(2000),
    }),
    exportRows: quotationExportRows,
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
      { name: "deskripsi", label: "Part Description", type: "text" },
      { name: "target_qty", label: "Target Qty", type: "number" },
      { name: "actual_qty", label: "Actual Qty", type: "number" },
    ],
    columns: [
      custCode,
      custPt,
      { ...col("part_no", "Part", "mono"), sub: (r) => r.deskripsi },
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
      deskripsi: optText(),
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
      { name: "durasi", label: "Durasi", type: "number", initial: 30, suffix: "menit" },
      { name: "peserta", label: "Peserta", type: "users", initial: (me) => me.id },
      { name: "nilai", label: "Nilai", type: "text" },
      { name: "ringkasan", label: "Ringkasan", type: "textarea" },
      { name: "status", label: "Status", type: "select", options: OPTIONS.refreshmentStatus, initial: "Terjadwal" },
      { name: "attachments", label: "Attach Dokumen", type: "files" },
    ],
    columns: [
      col("tanggal", "Tanggal", "date"),
      col("jenis", "Jenis"),
      col("topik", "Topik"),
      { key: "durasi", header: "Durasi", get: (r) => `${toNumber(r.durasi)} mnt` },
      { key: "peserta", header: "Peserta", get: (r, lk) => usernames(r.peserta, lk) || null },
      col("nilai", "Nilai"),
      col("status", "Status", "badge"),
      { key: "attachments", header: "Lampiran", get: (r) => (r.attachments?.length ? `${r.attachments.length} file` : null) },
    ],
    schema: z.object({
      tanggal: dateStr(true),
      jenis: oneOf(OPTIONS.refreshmentJenis, "Jenis"),
      topik: reqText("Topik"),
      durasi: num({ min: 0, int: true }),
      peserta: idList(),
      nilai: optText(50),
      ringkasan: optText(2000),
      status: oneOf(OPTIONS.refreshmentStatus, "Status"),
      attachments: attachmentList,
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
      { name: "skor", label: "Skor", type: "number", initial: 75, suffix: "/ 100" },
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

// ---------------------------------------------------------------------------
// Quotation: barang & status negosiasi per barang
// ---------------------------------------------------------------------------
export const MAX_QUOTATION_ITEMS = 100;

export type QuotationStatus = (typeof OPTIONS.quotationStatus)[number];
export type QuotationItem = {
  id?: string;
  position: number;
  part: string;
  harga: number;
  qty: number;
  margin_p: number;
  total: number;
  margin_rp: number;
  status: QuotationStatus;
};

/** Barang quotation (join `items`) terurut sesuai posisi input. */
export function quotationItems(row: Row): QuotationItem[] {
  return Array.isArray(row.items) ? [...(row.items as QuotationItem[])].sort((a, b) => a.position - b.position) : [];
}

/** Total, margin, nilai Win & Loss (Loss otomatis = total barang berstatus Loss). */
export function quotationTotals(items: { harga: unknown; qty: unknown; margin_p: unknown; status: string }[]) {
  const out = { total: 0, margin: 0, win: 0, loss: 0 };
  for (const i of items) {
    const total = toNumber(i.harga) * toNumber(i.qty);
    out.total += total;
    out.margin += Math.round((total * toNumber(i.margin_p)) / 100);
    if (i.status === "Win") out.win += total;
    if (i.status === "Loss") out.loss += total;
  }
  return out;
}

/** Jumlah barang per status, urut sesuai OPTIONS.quotationStatus. */
export function statusCounts(items: { status: string }[]) {
  return OPTIONS.quotationStatus
    .map((s) => ({ status: s, count: items.filter((i) => i.status === s).length }))
    .filter((s) => s.count);
}

/** "Win 2, Negosiasi 1" — untuk export & pencarian tabel. */
export const statusSummary = (items: { status: string }[]) =>
  statusCounts(items).map((s) => `${s.status} ${s.count}`).join(", ");

export const quotationItemSchema = z.object({
  part: reqText("Part", 300),
  qty: num({ min: 0 }).refine((n) => n > 0, "Qty harus lebih dari 0"),
  harga: num({ min: 0 }),
  margin_p: num({ min: -100, max: 100 }),
  status: oneOf(OPTIONS.quotationStatus, "Status"),
});

/** Form halaman create/edit quotation (client & server action). */
export const quotationFormSchema = ENTITIES.quotation.schema
  .extend({
    items: z
      .array(quotationItemSchema)
      .min(1, "Minimal 1 barang")
      .max(MAX_QUOTATION_ITEMS, `Maksimal ${MAX_QUOTATION_ITEMS} barang`),
  })
  .superRefine((v, ctx) => {
    if (v.tgl_quot && v.tgl_exp && v.tgl_exp < v.tgl_quot)
      ctx.addIssue({ code: "custom", path: ["tgl_exp"], message: "Tgl Exp tidak boleh sebelum Tgl Quot" });
  });

/** Satu baris Excel per barang (header quotation diulang) — format yang sama dipakai import. */
export function quotationExportRows(row: Row): Record<string, unknown>[] {
  const header = {
    customer_code: row.customer?.customer_code ?? "",
    quot_no: row.quot_no ?? "",
    kode_accurate: row.kode_accurate ?? "",
    tgl_quot: row.tgl_quot ?? "",
    tgl_exp: row.tgl_exp ?? "",
    remarks: row.remarks ?? "",
  };
  const items = quotationItems(row);
  if (!items.length) return [header];
  return items.map((i) => ({
    ...header,
    part: i.part,
    qty: toNumber(i.qty),
    harga: toNumber(i.harga),
    margin_p: toNumber(i.margin_p),
    status: i.status,
    total: toNumber(i.total),
    margin_rp: toNumber(i.margin_rp),
  }));
}

/** Field yang menyimpan path Storage untuk satu entitas */
export function filePathFields(def: EntityDef): string[] {
  return def.fields.filter((f) => f.type === "file" && f.pathField).map((f) => f.pathField!);
}

/** Field lampiran ganda (type "files", kolom jsonb Attachment[]) */
export function fileListFields(def: EntityDef): string[] {
  return def.fields.filter((f) => f.type === "files").map((f) => f.name);
}

/** Semua kolom yang menyimpan file (untuk select sebelum hapus) */
export function fileColumns(def: EntityDef): string[] {
  return [...filePathFields(def), ...fileListFields(def)];
}

export function asAttachments(v: unknown): Attachment[] {
  return Array.isArray(v) ? (v as Attachment[]).filter((a) => a && typeof a.path === "string") : [];
}

/** Semua path Storage milik satu baris (file tunggal + lampiran ganda) */
export function rowFilePaths(def: EntityDef, row: Record<string, unknown> | null | undefined): string[] {
  if (!row) return [];
  return [
    ...filePathFields(def).map((f) => row[f]),
    ...fileListFields(def).flatMap((f) => asAttachments(row[f]).map((a) => a.path)),
  ].filter((p): p is string => typeof p === "string" && !!p);
}

/** Baris → objek datar untuk export Excel (header = nama field, bisa di-import ulang) */
export function toExportRow(def: EntityDef, row: Row, lk: Lookup): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of def.fields) {
    if (f.type === "file") {
      if (f.nameField) out[f.nameField] = row[f.nameField] ?? "";
      continue;
    }
    if (f.type === "files") {
      out[f.name] = asAttachments(row[f.name]).map((a) => a.name).join(", ");
      continue;
    }
    if (f.type === "customer") out.customer_code = row.customer?.customer_code ?? "";
    else if (f.type === "users") out[f.name] = usernames(row[f.name], lk);
    else if (f.type === "user") out.sales = row[f.name] ? lk.profiles.get(row[f.name])?.username ?? "" : "";
    else if (f.type === "forecast") out.forecast_ref = row[f.name];
    else out[f.name] = row[f.name] ?? "";
  }
  // nilai turunan ikut diexport (diabaikan saat import)
  for (const c of def.columns) if (!(c.key in out)) out[c.key] = c.get(row, lk) ?? "";
  return out;
}

// ---------------------------------------------------------------------------
// Import Excel
// ---------------------------------------------------------------------------
export const MAX_IMPORT_ROWS = 2000;
export const MAX_IMPORT_ERRORS = 100;

export type ImportResult = {
  /** dryRun: jumlah data yang akan masuk */
  inserted: number;
  /** jumlah baris/data yang dilewati karena error */
  skipped: number;
  /** pesan error (maks. MAX_IMPORT_ERRORS) */
  errors: string[];
};

/** Nomor baris di Excel: readExcel menyimpan `__row` (baris kosong dilewati SheetJS). */
export const importLine = (r: Record<string, unknown>, i: number) => Number(r.__row) || i + 2;

export type ImportColumn = { key: string; label: string; required: boolean; hint: string };

/**
 * Kolom template import — nama & urutan sama dengan yang dibaca importEntity
 * (dan hasil Export Excel). Wajib atau tidak diturunkan dari schema Zod.
 */
export function importColumns(def: EntityDef): ImportColumn[] {
  const out: ImportColumn[] = [];
  for (const f of def.fields) {
    if (f.type === "file" || f.type === "files") continue;
    const required = !(def.schema.shape[f.name] as z.ZodType).safeParse("").success;
    const add = (key: string, hint: string) => out.push({ key, label: f.label, required, hint });
    if (f.type === "customer") add("customer_code", 'Kode customer dari sheet "Customer" (harus sudah ada di Customer DB)');
    else if (f.type === "user") add("sales", 'Username dari sheet "User"');
    else if (f.type === "users") add(f.name, 'Satu atau lebih username dari sheet "User", dipisah koma');
    else if (f.type === "select") add(f.name, `Salah satu: ${f.options?.join(", ")}`);
    else if (f.type === "date") add(f.name, "Format YYYY-MM-DD atau DD/MM/YYYY (sel tanggal Excel juga bisa)");
    else if (f.type === "month") add(f.name, "Format YYYY-MM, mis. 2026-10");
    else if (f.type === "number") add(f.name, `${f.money ? "Rupiah tanpa titik/Rp, mis. 1500000" : "Angka"}. Kosong = 0`);
    else if (f.type === "email") add(f.name, "Alamat email");
    else add(f.name, "Teks bebas");
  }
  if (def.columns.some((c) => c.key === "owner"))
    out.push({
      key: "owner",
      label: "Owner",
      required: false,
      hint: 'Username dari sheet "User". Kosong = akun yang meng-import. User lain hanya bisa diisi Master/Admin',
    });
  return out;
}

/** Baris → nilai tampilan (untuk PDF/Word) */
export function toDisplayRow(def: EntityDef, row: Row, lk: Lookup): string[] {
  return def.columns.map((c) => {
    const v = formatCell(c, c.get(row, lk));
    const sub = c.sub?.(row, lk);
    return sub ? `${v} - ${sub}` : v;
  });
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
    case "date":
      return fmtDay(String(v));
    default:
      return String(v);
  }
}
