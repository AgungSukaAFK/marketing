/**
 * Activity History — label & format yang dipakai server dan client
 * (tabel/kolom DB → bahasa yang dibaca moderator).
 */
import { ENTITIES, type EntityKey } from "@/lib/entities";
import { ROLE_LABEL, type Role } from "@/lib/constants";
import { fmtNumber } from "@/lib/format";
import { TONE } from "@/lib/status";

export const ACTIVITY_GROUPS = [
  { id: "data", label: "Perubahan data" },
  { id: "auth", label: "Login & keamanan" },
  { id: "account", label: "Kelola akun" },
  { id: "file", label: "Import / export / download" },
] as const;
export type ActivityGroup = (typeof ACTIVITY_GROUPS)[number]["id"];

export const ACTIVITY_ACTIONS = {
  create: { label: "Tambah", tone: TONE.green, group: "data" },
  update: { label: "Ubah", tone: TONE.blue, group: "data" },
  delete: { label: "Hapus", tone: TONE.red, group: "data" },
  login: { label: "Login", tone: TONE.emerald, group: "auth" },
  logout: { label: "Logout", tone: TONE.gray, group: "auth" },
  login_failed: { label: "Login gagal", tone: TONE.amber, group: "auth" },
  register: { label: "Registrasi", tone: TONE.sky, group: "auth" },
  password_change: { label: "Ganti password", tone: TONE.indigo, group: "auth" },
  password_forgot: { label: "Lupa password", tone: TONE.amber, group: "auth" },
  password_reset: { label: "Reset password", tone: TONE.orange, group: "account" },
  account_create: { label: "Buat akun", tone: TONE.green, group: "account" },
  account_delete: { label: "Hapus akun", tone: TONE.red, group: "account" },
  log_purge: { label: "Hapus log", tone: TONE.red, group: "account" },
  import: { label: "Import", tone: TONE.sky, group: "file" },
  export: { label: "Export", tone: TONE.indigo, group: "file" },
  download: { label: "Download", tone: TONE.indigo, group: "file" },
  backup: { label: "Backup", tone: TONE.sky, group: "file" },
  restore: { label: "Restore", tone: TONE.orange, group: "file" },
  reset_data: { label: "Reset data", tone: TONE.red, group: "file" },
} as const satisfies Record<string, { label: string; tone: string; group: ActivityGroup }>;

export type ActivityAction = keyof typeof ACTIVITY_ACTIONS;

export const isActivityAction = (v: string): v is ActivityAction => Object.hasOwn(ACTIVITY_ACTIONS, v);

/** Filter aksi: satu aksi ("update") atau satu kelompok ("g:auth"). */
export function actionsForFilter(v: string): ActivityAction[] {
  if (v.startsWith("g:")) {
    const g = v.slice(2);
    return (Object.keys(ACTIVITY_ACTIONS) as ActivityAction[]).filter((a) => ACTIVITY_ACTIONS[a].group === g);
  }
  return isActivityAction(v) ? [v] : [];
}

/** Baris activity_log yang dikirim ke tampilan. */
export type ActivityRow = {
  id: number;
  created_at: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_username: string | null;
  actor_role: Role | null;
  tenant_id: string | null;
  action: string;
  entity: string | null;
  record_id: string | null;
  label: string | null;
  fields: string[];
  change_count: number;
  ip: string | null;
  user_agent: string | null;
  meta: Record<string, unknown>;
};

export const ACTIVITY_COLUMNS =
  "id, created_at, actor_id, actor_name, actor_username, actor_role, tenant_id, action, entity, record_id, label, fields, change_count, ip, user_agent, meta";

// ---------------------------------------------------------------------------
// Modul & kolom
// ---------------------------------------------------------------------------
const EXTRA_ENTITIES: Record<string, string> = {
  auth: "Autentikasi",
  profiles: "Akun",
  tenants: "Company",
  app_settings: "Tampilan Aplikasi",
  menu_config: "Konfigurasi Menu",
  custom_menus: "Menu Kustom",
  access_control: "Kontrol Akses",
  user_preferences: "Preferensi Tampilan",
  quotation_items: "Barang Quotation",
  forecast_trend: "Forecast Trend",
  insights: "Dashboard / Analytics",
  tenant_data: "Data Company",
  activity_log: "Activity History",
};

/** Lookup tanpa ikut membaca prototype (nilai filter berasal dari input, mis. "constructor"). */
const own = <T>(o: Record<string, T> | undefined, k: string): T | undefined => (o && Object.hasOwn(o, k) ? o[k] : undefined);

const entityDef = (entity: string) => own(ENTITIES as Record<string, (typeof ENTITIES)[EntityKey]>, entity) ?? null;

export const entityLabel = (entity: string | null | undefined) =>
  !entity ? "-" : (entityDef(entity)?.title ?? own(EXTRA_ENTITIES, entity) ?? entity);

/** Pilihan filter Modul. */
export const ENTITY_OPTIONS = [
  ...Object.values(ENTITIES).map((d) => ({ value: d.key as string, label: d.title })),
  ...Object.entries(EXTRA_ENTITIES).map(([value, label]) => ({ value, label })),
].sort((a, b) => a.label.localeCompare(b.label, "id"));

const COMMON_FIELDS: Record<string, string> = {
  id: "ID",
  tenant_id: "Company",
  owner: "Owner",
  created_at: "Dibuat",
  updated_at: "Diubah",
  customer_id: "Customer",
  customer_code: "Customer Code",
  sales_id: "Sales",
  attachment_name: "Nama File",
  file_name: "Nama File",
};

const TABLE_FIELDS: Record<string, Record<string, string>> = {
  profiles: { name: "Nama", username: "Username", email: "Email", role: "Role", active: "Aktif", last_seen_at: "Login Terakhir" },
  tenants: { name: "Nama Company", code: "Kode" },
  app_settings: { app_name: "Nama Aplikasi", accent: "Aksen", font: "Font", density: "Kepadatan", header_cfg: "Header" },
  menu_config: { labels: "Label Menu", icons: "Ikon Menu", menu_order: "Urutan Menu", visibility: "Menu Tampil" },
  custom_menus: { menu_key: "ID Menu", label: "Label", icon: "Ikon", content: "Isi Halaman" },
  access_control: { user_id: "Akun", enabled: "Pembatasan Aktif", allowed_menus: "Menu Diizinkan" },
  user_preferences: { user_id: "Akun", key: "Halaman", value: "Pengaturan" },
  quotation_items: {
    quotation_id: "Quotation",
    position: "No",
    part: "Part",
    harga: "Harga",
    qty: "Qty",
    margin_p: "Margin %",
    total: "Total",
    margin_rp: "Margin Rp",
    status: "Status",
  },
  forecast_trend: {
    forecast_ref: "Forecast",
    smt1_qty: "Qty Semester 1",
    smt2_qty: "Qty Semester 2",
    actual_2025: "Actual 2025",
    forecast_2026: "Forecast 2026",
    alasan: "Alasan",
  },
};

export function fieldLabel(entity: string, key: string) {
  const f = entityDef(entity)?.fields.find((x) => x.name === key || x.pathField === key);
  return f?.label ?? own(own(TABLE_FIELDS, entity), key) ?? own(COMMON_FIELDS, key) ?? key;
}

/** Urutan kolom seperti di form modulnya; kolom lain di belakang. */
export function fieldOrder(entity: string, key: string) {
  const i = entityDef(entity)?.fields.findIndex((x) => x.name === key || x.pathField === key || x.nameField === key) ?? -1;
  if (i >= 0) return i;
  const j = Object.keys(own(TABLE_FIELDS, entity) ?? {}).indexOf(key);
  return j >= 0 ? j : 100;
}

const MONEY_FIELDS = new Set(["quotation_items.harga", "quotation_items.total", "quotation_items.margin_rp"]);

export const isMoneyField = (entity: string, key: string) =>
  MONEY_FIELDS.has(`${entity}.${key}`) || !!entityDef(entity)?.fields.find((x) => x.name === key)?.money;

// ---------------------------------------------------------------------------
// Format
// ---------------------------------------------------------------------------
const WIB = "Asia/Jakarta";

/** Waktu lengkap WIB, mis. "26 Okt 2026 14.32.10 WIB" — sama di server & browser. */
export function fmtWIB(v: string | null | undefined) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return `${d.toLocaleString("id-ID", {
    timeZone: WIB,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })} WIB`;
}

export function fmtWIBParts(v: string) {
  const d = new Date(v);
  return {
    date: d.toLocaleDateString("id-ID", { timeZone: WIB, day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("id-ID", { timeZone: WIB, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  };
}

const BROWSERS: [RegExp, string][] = [
  [/Edg(?:e|A|iOS)?\/(\d+)/, "Edge"],
  [/OPR\/(\d+)/, "Opera"],
  [/SamsungBrowser\/(\d+)/, "Samsung Internet"],
  [/Firefox\/(\d+)|FxiOS\/(\d+)/, "Firefox"],
  [/CriOS\/(\d+)|Chrome\/(\d+)/, "Chrome"],
  [/Version\/(\d+)[\d.]* (?:Mobile\/\S+ )?Safari/, "Safari"],
];
const SYSTEMS: [RegExp, string][] = [
  [/Windows NT/, "Windows"],
  [/iPhone|iPad|iPod/, "iOS"],
  [/Android/, "Android"],
  [/CrOS/, "ChromeOS"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Linux/, "Linux"],
];

/** "Chrome 141 · Windows" dari user agent (perkiraan, cukup untuk audit). */
export function describeDevice(ua: string | null | undefined) {
  if (!ua) return null;
  let browser = "";
  for (const [re, name] of BROWSERS) {
    const m = re.exec(ua);
    if (m) {
      const version = m.slice(1).find(Boolean);
      browser = version ? `${name} ${version}` : name;
      break;
    }
  }
  const os = SYSTEMS.find(([re]) => re.test(ua))?.[1];
  const kind = /iPad|Tablet/.test(ua) ? "Tablet" : /Mobi|iPhone|Android/.test(ua) ? "Mobile" : null;
  const text = [browser || "Browser lain", os, kind].filter(Boolean).join(" · ");
  return text;
}

const META_LABELS: Record<string, string> = {
  email: "Email",
  reason: "Keterangan",
  format: "Format",
  count: "Jumlah baris",
  inserted: "Data masuk",
  skipped: "Baris dilewati",
  rows: "Baris di file",
  file: "Nama file",
  path: "Lokasi file",
  title: "Judul",
  role: "Role",
  username: "Username",
  name: "Nama",
  from: "Dari",
  to: "Sampai",
  deleted: "Log dihapus",
  restored: "Baris direstore",
  tables: "Isi backup",
  imported: "Sumber",
};

const FORMAT_LABEL: Record<string, string> = { excel: "Excel (.xlsx)", pdf: "PDF", word: "Word (.docx)", json: "JSON" };

function metaValue(key: string, v: unknown): string {
  if (key === "format" && typeof v === "string") return own(FORMAT_LABEL, v) ?? v;
  if (key === "role" && typeof v === "string") return ROLE_LABEL[v as Role] ?? v;
  if ((key === "from" || key === "to") && typeof v === "string") return fmtWIB(v);
  if (key === "imported") return "Riwayat login lama (sebelum Activity History aktif)";
  if (typeof v === "number") return fmtNumber(v);
  if (typeof v === "boolean") return v ? "Ya" : "Tidak";
  if (v && typeof v === "object")
    return Object.entries(v as Record<string, unknown>)
      .map(([k, n]) => `${entityLabel(k)}: ${typeof n === "number" ? fmtNumber(n) : String(n)}`)
      .join(", ");
  return String(v ?? "-");
}

/** Detail tambahan event aplikasi (email, format export, jumlah baris, …). */
export function presentMeta(meta: Record<string, unknown> | null | undefined) {
  return Object.entries(meta ?? {})
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => ({ key: k, label: own(META_LABELS, k) ?? k, value: metaValue(k, v) }));
}

/** Satu baris keterangan singkat di tabel. */
export function summarize(row: ActivityRow) {
  const m = row.meta ?? {};
  const num = (k: string) => (typeof m[k] === "number" ? fmtNumber(m[k]) : null);
  switch (row.action) {
    case "update": {
      const shown = row.fields.slice(0, 4).map((f) => fieldLabel(row.entity ?? "", f));
      const more = row.fields.length > 4 ? ` +${row.fields.length - 4}` : "";
      const rel = row.change_count > 1 ? ` · ${fmtNumber(row.change_count)} perubahan` : "";
      return shown.length ? `Mengubah ${shown.join(", ")}${more}${rel}` : rel.slice(3) || null;
    }
    case "create":
    case "delete":
      return row.change_count > 1 ? `${fmtNumber(row.change_count)} perubahan (termasuk data terkait)` : null;
    case "import":
      return [num("inserted") && `${num("inserted")} data masuk`, num("skipped") && `${num("skipped")} dilewati`]
        .filter(Boolean)
        .join(" · ");
    case "export":
      return [own(FORMAT_LABEL, String(m.format)) ?? null, num("count") && `${num("count")} baris`].filter(Boolean).join(" · ");
    case "download":
      return typeof m.file === "string" ? m.file : null;
    case "login_failed":
    case "password_forgot":
      return [m.reason, m.email].filter(Boolean).join(" · ") || null;
    case "log_purge":
      return typeof m.from === "string" && typeof m.to === "string" ? `${fmtWIB(m.from)} – ${fmtWIB(m.to)}` : null;
    default:
      return row.change_count > 1 ? `${fmtNumber(row.change_count)} perubahan data` : null;
  }
}
